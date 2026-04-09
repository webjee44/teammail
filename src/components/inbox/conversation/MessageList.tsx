import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Pencil, Trash2, Check, X, Clock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AttachmentList } from "../Attachments";
import { renderMentions } from "../MentionTextarea";
import { ResponseTimeBadge } from "../ResponseTimeBadge";
import { supabase } from "@/integrations/supabase/client";
import type { Message, Comment } from "./types";

type ScheduledEmail = {
  id: string;
  to_email: string;
  from_email: string;
  subject: string;
  body: string;
  scheduled_at: string;
  status: string;
};

type Props = {
  messages: Message[];
  comments: Comment[];
  conversationSubject?: string;
  currentUserId?: string;
  onEditComment?: (commentId: string, newBody: string) => void;
  onDeleteComment?: (commentId: string) => void;
};

export function MessageList({ messages, comments, conversationSubject, currentUserId, onEditComment, onDeleteComment }: Props) {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages]);

  // Fetch pending scheduled emails matching this conversation
  useEffect(() => {
    if (!conversationSubject) return;
    const replySubject = conversationSubject.startsWith("Re:") ? conversationSubject : `Re: ${conversationSubject}`;
    const fetchScheduled = async () => {
      const { data } = await supabase
        .from("scheduled_emails")
        .select("id, to_email, from_email, subject, body, scheduled_at, status")
        .eq("status", "pending")
        .or(`subject.eq.${conversationSubject},subject.eq.${replySubject}`)
        .order("scheduled_at", { ascending: true });
      setScheduledEmails(data || []);
    };
    fetchScheduled();
  }, [conversationSubject]);

  const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const link = target.closest("a");
    if (link && link.href && link.href.startsWith("mailto:")) {
      e.preventDefault();
      e.stopPropagation();
      const mailtoStr = link.href.substring(7);
      const [emailPart, queryPart] = mailtoStr.split("?");
      const params = new URLSearchParams(queryPart || "");
      const to = decodeURIComponent(emailPart || "");
      const composeParams = new URLSearchParams();
      if (to) composeParams.set("to", to);
      if (params.get("subject")) composeParams.set("subject", params.get("subject")!);
      if (params.get("body")) composeParams.set("body", params.get("body")!);
      navigate(`/compose?${composeParams.toString()}`);
    }
  }, [navigate]);

  const startEditing = (comment: Comment) => {
    setEditingId(comment.id);
    setEditBody(comment.body);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditBody("");
  };

  const saveEdit = () => {
    if (editingId && editBody.trim() && onEditComment) {
      onEditComment(editingId, editBody.trim());
      cancelEditing();
    }
  };

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((msg, idx) => {
          const initials = msg.from_name
            ? msg.from_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
            : msg.from_email?.slice(0, 2).toUpperCase() ?? "?";

          // Show response time badge between inbound → outbound transitions
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const showResponseTime = prevMsg && !prevMsg.is_outbound && msg.is_outbound;
          const responseMinutes = showResponseTime
            ? (new Date(msg.sent_at).getTime() - new Date(prevMsg.sent_at).getTime()) / 60000
            : 0;

          return (
            <div key={msg.id}>
              {showResponseTime && responseMinutes > 0 && responseMinutes < 1440 && (
                <div className="flex items-center justify-center gap-2 py-1">
                  <div className="h-px flex-1 bg-border" />
                  <ResponseTimeBadge minutes={responseMinutes} variant="full" />
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              <div
                className={cn(
                  "rounded-lg border border-border p-4",
                  msg.is_outbound ? "bg-primary/5 ml-8" : "mr-8"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] bg-muted">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground">
                    {msg.from_name || msg.from_email}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(msg.sent_at), "d MMM yyyy, HH:mm", { locale: fr })}
                  </span>
                </div>
                {msg.body_html ? (
                  <div
                    className="text-sm text-foreground prose prose-sm max-w-none dark:prose-invert [&_a:not([href^='mailto:'])]:target-blank"
                    dangerouslySetInnerHTML={{ __html: msg.body_html.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ') }}
                    onClick={handleContentClick}
                  />
                ) : (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{msg.body_text}</p>
                )}
                <AttachmentList attachments={msg.attachments || []} />
              </div>
            </div>
          );
        })}

        {/* Scheduled emails */}
        {scheduledEmails.map((se) => (
          <div
            key={se.id}
            className="rounded-lg border border-dashed border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 ml-8"
          >
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                  <Clock className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground">
                {se.from_email}
              </span>
              <Badge variant="outline" className="text-[10px] h-5 border-amber-400/60 text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/30 gap-1">
                <Clock className="h-2.5 w-2.5" />
                Programmé · {format(new Date(se.scheduled_at), "d MMM à HH:mm", { locale: fr })}
              </Badge>
              <span className="text-xs text-muted-foreground ml-auto">
                → {se.to_email}
              </span>
            </div>
            <div
              className="text-sm text-foreground/80 prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: se.body }}
            />
          </div>
        ))}

        {comments.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Notes internes
              </p>
              {comments.map((comment) => {
                const isOwn = currentUserId === comment.user_id;
                const isEditing = editingId === comment.id;

                return (
                  <div
                    key={comment.id}
                    className="group rounded-lg bg-warning/10 border border-warning/20 p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={comment.author_avatar} />
                        <AvatarFallback className="text-[10px]">
                          {comment.author_name?.slice(0, 2).toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium">{comment.author_name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(comment.created_at), "d MMM, HH:mm", { locale: fr })}
                      </span>
                      {isOwn && !isEditing && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => startEditing(comment)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => onDeleteComment?.(comment.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          className="min-h-[60px] text-sm bg-background"
                          autoFocus
                        />
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEditing}>
                            <X className="h-3 w-3 mr-1" />
                            Annuler
                          </Button>
                          <Button size="sm" className="h-7 text-xs" onClick={saveEdit} disabled={!editBody.trim()}>
                            <Check className="h-3 w-3 mr-1" />
                            Enregistrer
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm">{renderMentions(comment.body)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
