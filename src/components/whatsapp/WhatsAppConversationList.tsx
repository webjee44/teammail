import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
    return (
      c.contact_name?.toLowerCase().includes(q) ||
      c.phone_number.includes(q) ||
      c.last_message?.toLowerCase().includes(q)
    );
  });

  const unreadCount = conversations.filter((c) => !c.is_read).length;

  return (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-green-500" />
            <h2 className="font-semibold text-[15px]">WhatsApp</h2>
            {unreadCount > 0 && (
              <span className="bg-green-500 text-white text-[11px] font-medium px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewConversation}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-[13px]"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-[13px]">
            {search ? "Aucun résultat" : "Aucune conversation WhatsApp"}
          </div>
        ) : (
          filtered.map((conv) => (
            <button
              key={conv.id}
              onClick={() => {
                onSelect(conv.id);
                if (!conv.is_read) {
                  supabase.from("whatsapp_conversations").update({ is_read: true }).eq("id", conv.id).then();
                }
              }}
              className={cn(
                "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-accent/50 transition-colors",
                selectedId === conv.id && "bg-primary/5 border-l-2 border-l-primary",
                !conv.is_read && "bg-green-50 dark:bg-green-950/20"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {!conv.is_read && (
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 mt-1" />
                  )}
                  <div className="min-w-0">
                    <p className={cn("text-[13px] truncate", !conv.is_read && "font-semibold")}>
                      {conv.contact_name || conv.phone_number}
                    </p>
                    <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                      {conv.last_message || "..."}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: fr })}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </>
  );
}
