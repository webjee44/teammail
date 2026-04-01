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
  Sparkles,
  ChevronDown,
  ChevronUp,
  User,
  Building2,
  DollarSign,
  CalendarDays,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Loader2,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AttachmentList, AttachmentUpload, FileToUpload } from "./Attachments";

const decodeHtml = (s = "") => {
  const t = document.createElement("textarea");
  t.innerHTML = s;
  return t.value.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
};

type MessageAttachment = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
};

type Message = {
  id: string;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  body_html: string | null;
  body_text: string | null;
  sent_at: string;
  is_outbound: boolean;
  attachments?: MessageAttachment[];
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
  priority?: string | null;
  is_noise?: boolean;
  ai_summary?: string | null;
  category?: string | null;
  entities?: any;
};

type Props = {
  conversation: ConversationDetailData | null;
  onStatusChange?: (id: string, status: "open" | "snoozed" | "closed") => void;
  onReply?: (id: string, body: string) => void;
  onComment?: (id: string, body: string) => void;
};

type Suggestion = { label: string; body: string };

const priorityConfig: Record<string, { icon: typeof ArrowUp; className: string; label: string }> = {
  high: { icon: ArrowUp, className: "text-destructive", label: "Haute" },
  medium: { icon: ArrowRight, className: "text-amber-500", label: "Moyenne" },
  low: { icon: ArrowDown, className: "text-muted-foreground", label: "Basse" },
};

const categoryLabels: Record<string, string> = {
  support: "Support",
  billing: "Facturation",
  commercial: "Commercial",
  notification: "Notification",
  other: "Autre",
};

export function ConversationDetail({ conversation, onStatusChange, onReply, onComment }: Props) {
  const [replyText, setReplyText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [activeTab, setActiveTab] = useState("reply");
  const [infoOpen, setInfoOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

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
  const prio = conversation.priority ? priorityConfig[conversation.priority] : null;
  const entities = conversation.entities || {};
  const hasEntities =
    entities.people?.length || entities.companies?.length || entities.amounts?.length || entities.dates?.length;
  const hasAiInfo = conversation.ai_summary || conversation.category || hasEntities;

  const handleSuggestReplies = async () => {
    setLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("ai-suggest-reply", {
        body: { conversation_id: conversation.id },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setSuggestions(data.suggestions || []);
    } catch (err: any) {
      toast.error("Erreur lors de la génération des suggestions");
      console.error(err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground truncate">
            {decodeHtml(conversation.subject)}
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
                  <MessageSquare className="h-4 w-4 mr-2 text-green-600" /> Ouvrir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange?.(conversation.id, "snoozed")}>
                  <Clock className="h-4 w-4 mr-2 text-amber-500" /> Mettre en pause
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange?.(conversation.id, "closed")}>
                  <CheckCircle className="h-4 w-4 mr-2" /> Fermer
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
          {prio && (
            <Badge variant="outline" className={cn("gap-1", prio.className)}>
              <prio.icon className="h-3 w-3" />
              {prio.label}
            </Badge>
          )}
          {conversation.category && (
            <Badge variant="secondary" className="gap-1">
              {categoryLabels[conversation.category] || conversation.category}
            </Badge>
          )}
          {conversation.is_noise && (
            <Badge variant="secondary" className="gap-1 text-muted-foreground">
              🔇 Bruit
            </Badge>
          )}
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

        {/* AI Info Panel */}
        {hasAiInfo && (
          <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between h-7 text-xs text-muted-foreground hover:text-foreground">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Informations IA
                </span>
                {infoOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {conversation.ai_summary && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  💡 {conversation.ai_summary}
                </p>
              )}
              {hasEntities && (
                <div className="flex flex-wrap gap-1.5">
                  {entities.people?.map((p: string, i: number) => (
                    <Badge key={`p-${i}`} variant="outline" className="text-[10px] gap-1">
                      <User className="h-2.5 w-2.5" /> {p}
                    </Badge>
                  ))}
                  {entities.companies?.map((c: string, i: number) => (
                    <Badge key={`c-${i}`} variant="outline" className="text-[10px] gap-1 border-blue-300 text-blue-600">
                      <Building2 className="h-2.5 w-2.5" /> {c}
                    </Badge>
                  ))}
                  {entities.amounts?.map((a: string, i: number) => (
                    <Badge key={`a-${i}`} variant="outline" className="text-[10px] gap-1 border-green-300 text-green-600">
                      <DollarSign className="h-2.5 w-2.5" /> {a}
                    </Badge>
                  ))}
                  {entities.dates?.map((d: string, i: number) => (
                    <Badge key={`d-${i}`} variant="outline" className="text-[10px] gap-1 border-amber-300 text-amber-600">
                      <CalendarDays className="h-2.5 w-2.5" /> {d}
                    </Badge>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
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
              {/* AI Suggestions */}
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setReplyText(s.body);
                        setSuggestions([]);
                      }}
                      className="text-xs px-2.5 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Sparkles className="h-3 w-3 inline mr-1" />
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              <Textarea
                placeholder="Tapez votre réponse..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="min-h-[80px] text-sm resize-none"
              />
              <div className="flex justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSuggestReplies}
                  disabled={loadingSuggestions}
                  className="gap-1"
                >
                  {loadingSuggestions ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Suggérer
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onReply?.(conversation.id, replyText);
                    setReplyText("");
                    setSuggestions([]);
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
