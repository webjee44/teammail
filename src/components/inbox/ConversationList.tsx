import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, ArrowUp, ArrowRight, ArrowDown, VolumeX, FileEdit } from "lucide-react";
import { ResponseTimeBadge } from "./ResponseTimeBadge";

const stripHtml = (s = "") => {
  const t = document.createElement("div");
  t.innerHTML = s;
  return (t.textContent || t.innerText || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
};

export type Conversation = {
  id: string;
  seq_number?: number;
  subject: string;
  snippet: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email?: string | null;
  to_name?: string | null;
  status: "open" | "closed";
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
  needs_reply?: boolean;
  is_sent?: boolean;
};

export type InboxFilter = "actionable" | "unread" | "replied" | "noise";

type FilterCounts = {
  actionable: number;
  unread: number;
  replied: number;
  noise: number;
};

type Props = {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  activeFilter: InboxFilter;
  onFilterChange: (filter: InboxFilter) => void;
  filterCounts: FilterCounts;
  showFilters?: boolean;
  bulkSelected: Set<string>;
  onBulkToggle: (id: string) => void;
  onBulkSelectAll: () => void;
  onBulkDeselectAll: () => void;
  responseTimes?: Map<string, number>;
  freshlyUpdated?: Set<string>;
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
  showUnreadOnly,
  onToggleUnreadOnly,
  unreadCount,
  showReplied,
  onToggleReplied,
  repliedCount,
  bulkSelected,
  onBulkToggle,
  onBulkSelectAll,
  onBulkDeselectAll,
  responseTimes,
  freshlyUpdated,
}: Props) {
  const bulkMode = bulkSelected.size > 0;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  const hasToggles = (noiseCount ?? 0) > 0 || showAllMails !== undefined || onToggleUnreadOnly || onToggleReplied;
  const allSelected = conversations.length > 0 && bulkSelected.size === conversations.length;

  return (
    <div className="flex flex-col h-full">
      {/* Bulk select header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/30">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(checked) => {
            if (checked) onBulkSelectAll();
            else onBulkDeselectAll();
          }}
          className="h-4 w-4"
          aria-label="Tout sélectionner"
        />
        <span className="text-xs text-muted-foreground">
          {bulkMode ? `${bulkSelected.size} sélectionné(s)` : "Sélectionner"}
        </span>

        {/* Filter toggles */}
        {hasToggles && (
          <div className="flex items-center gap-3 ml-auto">
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
            {onToggleUnreadOnly && (
              <label htmlFor="unread-only" className="flex items-center gap-1.5 cursor-pointer">
                <Switch
                  id="unread-only"
                  checked={showUnreadOnly}
                  onCheckedChange={onToggleUnreadOnly}
                  className="scale-75"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Non lus{unreadCount != null ? ` (${unreadCount})` : ''}
                </span>
              </label>
            )}
            {onToggleReplied && (
              <label htmlFor="show-replied" className="flex items-center gap-1.5 cursor-pointer">
                <Switch
                  id="show-replied"
                  checked={showReplied}
                  onCheckedChange={onToggleReplied}
                  className="scale-75"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Répondus{repliedCount != null ? ` (${repliedCount})` : ''}
                </span>
              </label>
            )}
          </div>
        )}
      </div>

      {conversations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Aucune conversation
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-border">
            {conversations.map((conv) => {
              // For sent conversations, display recipient instead of sender
              const displayName = conv.is_sent
                ? (conv.to_name || conv.to_email || "Unknown")
                : (conv.from_name || conv.from_email || "Unknown");
              const displayEmail = conv.is_sent
                ? (conv.to_name && conv.to_email ? conv.to_email : null)
                : (conv.from_name && conv.from_email ? conv.from_email : null);

              const initials = conv.is_sent
                ? conv.to_name
                  ? conv.to_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                  : conv.to_email?.slice(0, 2).toUpperCase() ?? "?"
                : conv.from_name
                  ? conv.from_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  : conv.from_email?.slice(0, 2).toUpperCase() ?? "?";

              const prio = conv.priority ? priorityConfig[conv.priority] : null;
              const PrioIcon = prio?.icon;
              const isChecked = bulkSelected.has(conv.id);
              const isFresh = freshlyUpdated?.has(conv.id);

              const isUrgent = conv.needs_reply && (conv.priority === "high" || (responseTimes?.has(conv.id) && (responseTimes.get(conv.id)! > 60)));

              return (
                  <div
                  key={conv.id}
                  className={cn(
                    "w-full text-left p-3 hover:bg-accent/50 transition-all duration-500 flex items-start gap-2",
                    selectedId === conv.id && "bg-accent",
                    !conv.is_read && "bg-primary/5",
                    conv.is_noise && "opacity-60",
                    isChecked && "bg-primary/10",
                    isFresh && "animate-pulse-highlight",
                    isUrgent && "border-l-[3px] border-l-destructive bg-destructive/5"
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => onBulkToggle(conv.id)}
                    className="h-4 w-4 mt-1 shrink-0"
                    aria-label={`Sélectionner ${conv.subject}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={() => onSelect(conv.id)}
                    className="flex-1 min-w-0 text-left"
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
                                "text-sm truncate flex items-center gap-1",
                                !conv.is_read ? "font-semibold text-foreground" : "text-foreground"
                              )}
                            >
                              {conv.is_sent && <span className="text-muted-foreground">→</span>}
                              {displayName}
                            </span>
                            {displayEmail && displayEmail !== displayName && (
                              <span className="text-[11px] text-muted-foreground truncate">
                                {displayEmail}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1.5">
                            {responseTimes?.has(conv.id) && (
                              <ResponseTimeBadge minutes={responseTimes.get(conv.id)!} variant="compact" />
                            )}
                            {formatDistanceToNow(new Date(conv.last_message_at), {
                              addSuffix: false,
                              locale: fr,
                            })}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "text-sm truncate flex items-center gap-1.5",
                            !conv.is_read ? "font-medium text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {conv.seq_number && (
                            <span className="text-[10px] font-mono text-muted-foreground shrink-0">#{conv.seq_number}</span>
                          )}
                          {stripHtml(conv.subject)}
                        </p>
                        {conv.ai_summary ? (
                          <p className="text-xs text-muted-foreground truncate">{conv.ai_summary}</p>
                        ) : conv.snippet ? (
                          <p className="text-xs text-muted-foreground truncate">{stripHtml(conv.snippet)}</p>
                        ) : null}
                        <div className="flex items-center gap-1.5 mt-1">
                          {conv.needs_reply && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive">
                              ⏳ En attente
                            </span>
                          )}
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
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
