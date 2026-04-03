import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AttachmentList } from "../Attachments";
import { renderMentions } from "../MentionTextarea";
import type { Message, Comment } from "./types";

type Props = {
  messages: Message[];
  comments: Comment[];
  currentUserId?: string;
  onEditComment?: (commentId: string, newBody: string) => void;
  onDeleteComment?: (commentId: string) => void;
};

export function MessageList({ messages, comments, currentUserId, onEditComment, onDeleteComment }: Props) {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

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
        {messages.map((msg) => {
          const initials = msg.from_name
            ? msg.from_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
            : msg.from_email?.slice(0, 2).toUpperCase() ?? "?";

          return (
            <div
              key={msg.id}
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
                  className="text-sm text-foreground prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: msg.body_html }}
                />
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap">{msg.body_text}</p>
              )}
              <AttachmentList attachments={msg.attachments || []} />
            </div>
          );
        })}

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
