import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ArrowUp, ArrowRight, ArrowDown, VolumeX, FileEdit } from "lucide-react";

const stripHtml = (s = "") => {
  const t = document.createElement("div");
  t.innerHTML = s;
  return (t.textContent || t.innerText || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
};

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
  priority?: string | null;
  is_noise?: boolean;
  ai_summary?: string | null;
  category?: string | null;
  entities?: any;
  has_draft?: boolean;
};

type Props = {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  hideNoise?: boolean;
  onToggleNoise?: () => void;
  noiseCount?: number;
  showAllMails?: boolean;
  onToggleAllMails?: () => void;
};

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

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  loading,
  hideNoise,
  onToggleNoise,
  noiseCount,
  showAllMails,
  onToggleAllMails,
}: Props) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  const hasToggles = (noiseCount ?? 0) > 0 || showAllMails !== undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Filter toggles — single row */}
      {hasToggles && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border bg-muted/30">
          {(noiseCount ?? 0) > 0 && (
            <label htmlFor="hide-noise" className="flex items-center gap-1.5 cursor-pointer">
              <Switch
                id="hide-noise"
                checked={hideNoise}
                onCheckedChange={onToggleNoise}
                className="scale-75"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Bruit ({noiseCount})
              </span>
            </label>
          )}
          {showAllMails !== undefined && (
            <label htmlFor="show-all" className="flex items-center gap-1.5 cursor-pointer">
              <Switch
                id="show-all"
                checked={showAllMails}
                onCheckedChange={onToggleAllMails}
                className="scale-75"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Tous les mails
              </span>
            </label>
          )}
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Aucune conversation
        </div>
      ) : (
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

              const prio = conv.priority ? priorityConfig[conv.priority] : null;
              const PrioIcon = prio?.icon;

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    "w-full text-left p-3 hover:bg-accent/50 transition-colors",
                    selectedId === conv.id && "bg-accent",
                    !conv.is_read && "bg-primary/5",
                    conv.is_noise && "opacity-60"
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
                        <div className="flex flex-col min-w-0">
                          <span
                            className={cn(
                              "text-sm truncate",
                              !conv.is_read ? "font-semibold text-foreground" : "text-foreground"
                            )}
                          >
                            {conv.from_name || conv.from_email || "Unknown"}
                          </span>
                          {conv.from_name && conv.from_email && (
                            <span className="text-[11px] text-muted-foreground truncate">
                              {conv.from_email}
                            </span>
                          )}
                        </div>
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
                        {stripHtml(conv.subject)}
                      </p>
                      {conv.ai_summary ? (
                        <p className="text-xs text-muted-foreground truncate">{conv.ai_summary}</p>
                      ) : conv.snippet ? (
                        <p className="text-xs text-muted-foreground truncate">{decodeHtml(conv.snippet)}</p>
                      ) : null}
                      <div className="flex items-center gap-1.5 mt-1">
                        {PrioIcon && (
                          <span className={cn("flex items-center", prio?.className)}>
                            <PrioIcon className="h-3 w-3" />
                          </span>
                        )}
                        {conv.category && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {categoryLabels[conv.category] || conv.category}
                          </span>
                        )}
                        {conv.is_noise && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            🔇 Bruit
                          </span>
                        )}
                        {conv.has_draft && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <FileEdit className="h-2.5 w-2.5" />
                            Brouillon
                          </span>
                        )}
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
      )}
    </div>
  );
}
