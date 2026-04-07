import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Phone, User, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
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
};

interface Props {
  conversationId: string;
}

export function WhatsAppConversationDetail({ conversationId }: Props) {
  const [conversation, setConversation] = useState<WAConversation | null>(null);
  const [messages, setMessages] = useState<WAMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    const [{ data: conv }, { data: msgs }] = await Promise.all([
      supabase.from("whatsapp_conversations").select("id, phone_number, contact_name").eq("id", conversationId).single(),
      supabase.from("whatsapp_messages").select("id, body, media_type, media_url, is_outbound, from_name, from_phone, sent_at").eq("conversation_id", conversationId).order("sent_at", { ascending: true }),
    ]);
    if (conv) setConversation(conv);
    if (msgs) setMessages(msgs);
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`wa-messages-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as WAMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!replyText.trim() || !conversation) return;
    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await supabase.functions.invoke("wasender-send", {
        body: {
          to: conversation.phone_number,
          text: replyText.trim(),
          conversation_id: conversationId,
        },
      });

      if (res.error) throw new Error(res.error.message);
      setReplyText("");
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
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500" />
      </div>
    );
  }

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
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <User className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-[14px]">{conversation.contact_name || conversation.phone_number}</p>
            <p className="text-[12px] text-muted-foreground">{conversation.phone_number}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Phone className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-[hsl(var(--muted))]/30">
        {groupedMessages.map((group) => (
          <div key={group.date}>
            <div className="flex justify-center my-3">
              <span className="text-[11px] text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border/50">
                {group.date}
              </span>
            </div>
            {group.messages.map((msg) => (
              <div key={msg.id} className={cn("flex mb-1.5", msg.is_outbound ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[65%] rounded-lg px-3 py-2 text-[13px]",
                    msg.is_outbound
                      ? "bg-green-100 dark:bg-green-900/40 text-foreground rounded-br-sm"
                      : "bg-background text-foreground shadow-sm rounded-bl-sm border border-border/50"
                  )}
                >
                  {!msg.is_outbound && msg.from_name && (
                    <p className="text-[11px] font-medium text-green-600 mb-0.5">{msg.from_name}</p>
                  )}
                  {msg.media_type && msg.media_url && (
                    <div className="mb-1">
                      {msg.media_type === "image" ? (
                        <img src={msg.media_url} className="rounded max-w-full max-h-52" alt="media" />
                      ) : (
                        <div className="text-[12px] text-muted-foreground italic">[{msg.media_type}]</div>
                      )}
                    </div>
                  )}
                  {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
                  <p className={cn("text-[10px] mt-1", msg.is_outbound ? "text-green-600/60" : "text-muted-foreground/60", "text-right")}>
                    {format(new Date(msg.sent_at), "HH:mm")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply area */}
      <div className="border-t border-border p-3 bg-background">
        <div className="flex items-end gap-2">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tapez un message..."
            className="min-h-[40px] max-h-[120px] resize-none text-[13px]"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!replyText.trim() || sending}
            size="icon"
            className="h-9 w-9 bg-green-500 hover:bg-green-600 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
