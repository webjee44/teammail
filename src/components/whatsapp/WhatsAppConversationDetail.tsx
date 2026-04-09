import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Phone, MoreHorizontal, Paperclip, X, FileText, Download, Check, CheckCheck, Trash2 } from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type WAMessage = {
  id: string;
  body: string | null;
  media_type: string | null;
  media_url: string | null;
  is_outbound: boolean;
  from_name: string | null;
  from_phone: string | null;
  sent_at: string;
};

type WAConversation = {
  id: string;
  phone_number: string;
  contact_name: string | null;
  contacts: { name: string | null } | null;
};

interface Props {
  conversationId: string;
  onDelete?: (id: string) => void;
}

function MediaRenderer({ media_type, media_url, body }: { media_type: string; media_url: string; body?: string | null }) {
  if (media_type === "image") {
    return (
      <a href={media_url} target="_blank" rel="noopener noreferrer">
        <img src={media_url} className="rounded-md max-w-full max-h-52 cursor-pointer hover:opacity-90 transition" alt={body || "image"} />
      </a>
    );
  }
  if (media_type === "video") {
    return <video src={media_url} controls className="rounded-md max-w-full max-h-52" preload="metadata" />;
  }
  if (media_type === "audio") {
    return <audio src={media_url} controls className="w-full max-w-[240px]" preload="metadata" />;
  }
  if (media_type === "document") {
    const fileName = media_url.split("/").pop() || "Document";
    return (
      <a
        href={media_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2.5 rounded-lg bg-background/60 hover:bg-background transition text-[12px] border border-border/30"
      >
        <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
        <span className="truncate flex-1 font-medium">{fileName}</span>
        <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </a>
    );
  }
  return <div className="text-[12px] text-muted-foreground italic">[{media_type}]</div>;
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function WhatsAppConversationDetail({ conversationId, onDelete }: Props) {
  const [conversation, setConversation] = useState<WAConversation | null>(null);
  const [messages, setMessages] = useState<WAMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    const [{ data: conv }, { data: msgs }] = await Promise.all([
      supabase.from("whatsapp_conversations").select("id, phone_number, contact_name, contacts(name)").eq("id", conversationId).single(),
      supabase.from("whatsapp_messages").select("id, body, media_type, media_url, is_outbound, from_name, from_phone, sent_at").eq("conversation_id", conversationId).order("sent_at", { ascending: true }),
    ]);
    if (conv) setConversation(conv as unknown as WAConversation);
    if (msgs) setMessages(msgs);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`wa-messages-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const newMsg = payload.new as WAMessage;
        setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 16 Mo)");
      return;
    }
    setAttachedFile(file);
    if (file.type.startsWith("image/")) {
      setAttachedPreview(URL.createObjectURL(file));
    } else {
      setAttachedPreview(null);
    }
  };

  const clearAttachment = () => {
    setAttachedFile(null);
    if (attachedPreview) {
      URL.revokeObjectURL(attachedPreview);
      setAttachedPreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const getMediaType = (file: File): string => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "document";
  };

  const handleSend = async () => {
    if ((!replyText.trim() && !attachedFile) || !conversation) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const payload: Record<string, unknown> = {
        to: conversation.phone_number,
        conversation_id: conversationId,
      };
      if (replyText.trim()) payload.text = replyText.trim();
      if (attachedFile) {
        payload.media = {
          data: await fileToBase64(attachedFile),
          mimetype: attachedFile.type,
          filename: attachedFile.name,
          mediatype: getMediaType(attachedFile),
        };
      }

      const res = await supabase.functions.invoke("wasender-send", { body: payload });
      if (res.error) throw new Error(res.error.message);
      setReplyText("");
      clearAttachment();
    } catch (err: any) {
      toast.error("Erreur d'envoi: " + (err.message || "Erreur inconnue"));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  const displayName = conversation.contacts?.name || conversation.contact_name || conversation.phone_number;
  const initials = getInitials(displayName);

  // Group messages by date
  const groupedMessages: { date: string; messages: WAMessage[] }[] = [];
  messages.forEach((msg) => {
    const dateStr = format(new Date(msg.sent_at), "d MMMM yyyy", { locale: fr });
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && lastGroup.date === dateStr) {
      lastGroup.messages.push(msg);
    } else {
      groupedMessages.push({ date: dateStr, messages: [msg] });
    }
  });

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header — Front.com style */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[12px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-[14px] leading-tight">{displayName}</p>
            <p className="text-[12px] text-muted-foreground leading-tight mt-0.5">{conversation.phone_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
            <Phone className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete?.(conversationId)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer la conversation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 bg-muted/20">
        {groupedMessages.map((group) => (
          <div key={group.date}>
            {/* Date separator — Front.com style */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border/60" />
              <span className="text-[11px] font-medium text-muted-foreground px-1">
                {group.date}
              </span>
              <div className="flex-1 h-px bg-border/60" />
            </div>

            {group.messages.map((msg, idx) => {
              const prevMsg = idx > 0 ? group.messages[idx - 1] : null;
              const isConsecutive = prevMsg && prevMsg.is_outbound === msg.is_outbound;

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.is_outbound ? "justify-end" : "justify-start",
                    isConsecutive ? "mt-0.5" : "mt-3"
                  )}
                >
                  {/* Inbound avatar */}
                  {!msg.is_outbound && !isConsecutive && (
                    <Avatar className="h-7 w-7 mr-2 mt-1 shrink-0">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  {!msg.is_outbound && isConsecutive && <div className="w-7 mr-2 shrink-0" />}

                  <div
                    className={cn(
                      "max-w-[60%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed",
                      msg.is_outbound
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-card text-card-foreground shadow-sm border border-border/40 rounded-bl-md"
                    )}
                  >
                    {!msg.is_outbound && msg.from_name && !isConsecutive && (
                      <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5">{msg.from_name}</p>
                    )}
                    {msg.media_type && msg.media_url && (
                      <div className="mb-1.5">
                        <MediaRenderer media_type={msg.media_type} media_url={msg.media_url} body={msg.body} />
                      </div>
                    )}
                    {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
                    <div className={cn(
                      "flex items-center gap-1 mt-1",
                      msg.is_outbound ? "justify-end" : "justify-end"
                    )}>
                      <span className={cn(
                        "text-[10px]",
                        msg.is_outbound ? "text-primary-foreground/50" : "text-muted-foreground/60"
                      )}>
                        {format(new Date(msg.sent_at), "HH:mm")}
                      </span>
                      {msg.is_outbound && (
                        <CheckCheck className={cn("h-3 w-3", "text-primary-foreground/50")} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment preview */}
      {attachedFile && (
        <div className="px-4 pt-2 bg-background border-t border-border">
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/50 text-[12px]">
            {attachedPreview ? (
              <img src={attachedPreview} className="h-12 w-12 rounded-lg object-cover" alt="preview" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-[12px]">{attachedFile.name}</p>
              <p className="text-muted-foreground text-[11px]">{(attachedFile.size / 1024).toFixed(0)} Ko</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-lg" onClick={clearAttachment}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Reply area — Front.com style */}
      <div className="border-t border-border p-3 bg-background">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tapez un message..."
            className="min-h-[40px] max-h-[120px] resize-none text-[13px] rounded-xl border-border/60 focus:border-primary/50 bg-muted/30 focus:bg-background transition-colors"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={(!replyText.trim() && !attachedFile) || sending}
            size="icon"
            className="h-9 w-9 rounded-xl bg-primary hover:bg-primary/90 shrink-0 transition-all disabled:opacity-30"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
