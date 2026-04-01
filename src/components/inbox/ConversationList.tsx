import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type Conversation = {
  id: string;
  subject: string;
  snippet: string | null;
  from_email: string | null;
  from_name: string | null;
  status: "open" | "snoozed" | "closed";
  assigned_to: string | null;
  is_read: boolean;
  last_message_at: string;
  tags?: { id: string; name: string; color: string }[];
  assignee_name?: string;
};

type Props = {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
};

export function ConversationList({ conversations, selectedId, onSelect, loading }: Props) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Aucune conversation
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="divide-y divide-border">
        {conversations.map((conv) => {
          const initials = conv.from_name
            ? conv.from_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)
            : conv.from_email?.slice(0, 2).toUpperCase() ?? "?";

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                "w-full text-left p-3 hover:bg-accent/50 transition-colors",
                selectedId === conv.id && "bg-accent",
                !conv.is_read && "bg-primary/5"
              )}
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                  <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-sm truncate",
                        !conv.is_read ? "font-semibold text-foreground" : "text-foreground"
                      )}
                    >
                      {conv.from_name || conv.from_email || "Unknown"}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(conv.last_message_at), {
                        addSuffix: false,
                        locale: fr,
                      })}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-sm truncate",
                      !conv.is_read ? "font-medium text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {conv.subject}
                  </p>
                  {conv.snippet && (
                    <p className="text-xs text-muted-foreground truncate">{(() => { const t = document.createElement("textarea"); t.innerHTML = conv.snippet; return t.value.replace(/\u00A0/g, " ").trim(); })()}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    {conv.tags?.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${tag.color}20`,
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                    {conv.assignee_name && (
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        → {conv.assignee_name}
                      </span>
                    )}
                  </div>
                </div>
                {!conv.is_read && (
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
