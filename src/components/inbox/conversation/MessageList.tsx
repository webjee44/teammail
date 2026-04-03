import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AttachmentList } from "../Attachments";
import type { Message, Comment } from "./types";

type Props = {
  messages: Message[];
  comments: Comment[];
};

export function MessageList({ messages, comments }: Props) {
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
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-lg bg-warning/10 border border-warning/20 p-3"
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
                  </div>
                  <p className="text-sm">{comment.body}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
