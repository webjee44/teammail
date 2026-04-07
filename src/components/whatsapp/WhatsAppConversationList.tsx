import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Plus, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

type WAConversation = {
  id: string;
  phone_number: string;
  contact_name: string | null;
  last_message: string | null;
  last_message_at: string;
  is_read: boolean;
  status: string;
  contact_id: string | null;
  contacts: { name: string | null } | null;
};

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
];

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function WhatsAppConversationList({ selectedId, onSelect, onNewConversation }: Props) {
  const [conversations, setConversations] = useState<WAConversation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("id, phone_number, contact_name, last_message, last_message_at, is_read, status, contact_id, contacts(name)")
      .eq("status", "open")
      .order("last_message_at", { ascending: false });

    if (data) setConversations(data as unknown as WAConversation[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel("wa-conversations")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const displayName = c.contacts?.name || c.contact_name || "";
    return (
      displayName.toLowerCase().includes(q) ||
      c.phone_number.includes(q) ||
      c.last_message?.toLowerCase().includes(q)
    );
  });

  const unreadCount = conversations.filter((c) => !c.is_read).length;

  return (
    <>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-green-500/10">
              <MessageCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="font-semibold text-[15px]">WhatsApp</h2>
            {unreadCount > 0 && (
              <span className="bg-green-500 text-white text-[10px] font-semibold min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onNewConversation}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher une conversation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-[13px] bg-muted/50 border-transparent focus:border-border focus:bg-background transition-colors"
          />
        </div>
      </div>

      {/* Conversation count */}
      <div className="px-4 pb-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {filtered.length} conversation{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-[13px] text-muted-foreground">
              {search ? "Aucun résultat" : "Aucune conversation"}
            </p>
          </div>
        ) : (
          filtered.map((conv) => {
            const displayName = conv.contacts?.name || conv.contact_name || conv.phone_number;
            const initials = getInitials(displayName);
            const colorClass = hashColor(conv.phone_number);

            return (
              <button
                key={conv.id}
                onClick={() => {
                  onSelect(conv.id);
                  if (!conv.is_read) {
                    supabase.from("whatsapp_conversations").update({ is_read: true }).eq("id", conv.id).then();
                  }
                }}
                className={cn(
                  "w-full text-left px-4 py-3 transition-colors relative group",
                  "hover:bg-accent/50",
                  selectedId === conv.id
                    ? "bg-primary/5 dark:bg-primary/10"
                    : !conv.is_read
                    ? "bg-green-50/50 dark:bg-green-950/10"
                    : ""
                )}
              >
                {/* Active indicator */}
                {selectedId === conv.id && (
                  <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />
                )}

                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                    <AvatarFallback className={cn("text-[12px] font-semibold", colorClass)}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn(
                        "text-[13px] truncate",
                        !conv.is_read ? "font-semibold text-foreground" : "font-medium text-foreground"
                      )}>
                        {displayName}
                      </p>
                      <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                        {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: fr })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className={cn(
                        "text-[12px] truncate flex-1",
                        !conv.is_read ? "text-foreground/70" : "text-muted-foreground"
                      )}>
                        {conv.last_message || "Nouvelle conversation"}
                      </p>
                      {!conv.is_read && (
                        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
