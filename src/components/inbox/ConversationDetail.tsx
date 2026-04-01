import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  UserPlus,
  Tag,
  Clock,
  CheckCircle,
  MessageSquare,
  Send,
  MoreHorizontal,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  body_html: string | null;
  body_text: string | null;
  sent_at: string;
  is_outbound: boolean;
};

type Comment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name?: string;
  author_avatar?: string;
};

type ConversationDetailData = {
  id: string;
  subject: string;
  from_email: string | null;
  from_name: string | null;
  status: "open" | "snoozed" | "closed";
  assigned_to: string | null;
  assignee_name?: string;
  tags?: { id: string; name: string; color: string }[];
  messages: Message[];
  comments: Comment[];
};

type Props = {
  conversation: ConversationDetailData | null;
  onStatusChange?: (id: string, status: "open" | "snoozed" | "closed") => void;
  onReply?: (id: string, body: string) => void;
  onComment?: (id: string, body: string) => void;
};

export function ConversationDetail({ conversation, onStatusChange, onReply, onComment }: Props) {
  const [replyText, setReplyText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [activeTab, setActiveTab] = useState("reply");

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <MessageSquare className="h-12 w-12 mx-auto opacity-30" />
          <p className="text-sm">Sélectionnez une conversation</p>
        </div>
      </div>
    );
  }

  const statusConfig = {
    open: { label: "Ouvert", icon: MessageSquare, className: "text-green-600" },
    snoozed: { label: "En pause", icon: Clock, className: "text-amber-500" },
    closed: { label: "Fermé", icon: CheckCircle, className: "text-muted-foreground" },
  };

  const status = statusConfig[conversation.status];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground truncate">
            {conversation.subject}
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onStatusChange?.(conversation.id, "open")}>
                  <MessageSquare className="h-4 w-4 mr-2 text-green-600" /> Open
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange?.(conversation.id, "snoozed")}>
                  <Clock className="h-4 w-4 mr-2 text-amber-500" /> Snooze
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange?.(conversation.id, "closed")}>
                  <CheckCircle className="h-4 w-4 mr-2" /> Close
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn("gap-1", status.className)}>
            <status.icon className="h-3 w-3" />
            {status.label}
          </Badge>
          {conversation.assignee_name && (
            <Badge variant="secondary" className="gap-1">
              <UserPlus className="h-3 w-3" />
              {conversation.assignee_name}
            </Badge>
          )}
          {conversation.tags?.map((tag) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="gap-1"
              style={{ borderColor: tag.color, color: tag.color }}
            >
              <Tag className="h-3 w-3" />
              {tag.name}
            </Badge>
          ))}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {conversation.messages.map((msg) => {
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
              </div>
            );
          })}

          {/* Internal comments */}
          {conversation.comments.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Notes internes
                </p>
                {conversation.comments.map((comment) => (
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

      {/* Reply / Comment area */}
      <div className="border-t border-border p-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-8 mb-2">
            <TabsTrigger value="reply" className="text-xs h-7 px-3">
              <Send className="h-3 w-3 mr-1" /> Répondre
            </TabsTrigger>
            <TabsTrigger value="comment" className="text-xs h-7 px-3">
              <MessageSquare className="h-3 w-3 mr-1" /> Note interne
            </TabsTrigger>
          </TabsList>
          <TabsContent value="reply" className="mt-0">
            <div className="space-y-2">
              <Textarea
                placeholder="Tapez votre réponse..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="min-h-[80px] text-sm resize-none"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    onReply?.(conversation.id, replyText);
                    setReplyText("");
                  }}
                  disabled={!replyText.trim()}
                >
                  <Send className="h-3 w-3 mr-1" /> Envoyer
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="comment" className="mt-0">
            <div className="space-y-2">
              <Textarea
                placeholder="Ajouter une note interne..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="min-h-[80px] text-sm resize-none bg-warning/5 border-warning/20"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onComment?.(conversation.id, commentText);
                    setCommentText("");
                  }}
                  disabled={!commentText.trim()}
                >
                  <MessageSquare className="h-3 w-3 mr-1" /> Ajouter note
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
