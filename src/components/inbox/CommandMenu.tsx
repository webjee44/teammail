import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Mail, Paperclip, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type SearchRow = {
  conversation_id: string;
  subject: string | null;
  snippet: string | null;
  from_name: string | null;
  from_email: string | null;
  mailbox_email: string | null;
  last_message_at: string;
  has_attachment: boolean;
  is_unread: boolean;
};

type FilterKey = "attachment" | "recent" | "fromMe" | "unread";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (conversationId: string) => void;
  mailboxId?: string | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    ...(sameYear ? {} : { year: "2-digit" }),
  });
}

export function highlightMatch(text: string, query: string): (string | JSX.Element)[] {
  if (!query) return [text];
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${safe})`, "ig");
  const parts = text.split(re);
  return parts.map((part, i) =>
    re.test(part) && part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-primary/20 text-foreground rounded-sm px-0.5">{part}</mark>
      : part
  );
}

export function CommandMenu({ open, onOpenChange, onSelect, mailboxId }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    attachment: false, recent: false, fromMe: false, unread: false,
  });
  const [mailboxLabel, setMailboxLabel] = useState<string | null>(null);
  const navigate = useNavigate();
  const reqIdRef = useRef(0);

  // Resolve mailbox label for placeholder
  useEffect(() => {
    if (!mailboxId) { setMailboxLabel(null); return; }
    supabase
      .from("team_mailboxes")
      .select("label, email")
      .eq("id", mailboxId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setMailboxLabel(data.label || data.email);
      });
  }, [mailboxId]);

  const placeholder = useMemo(() => {
    if (mailboxLabel) return `Rechercher dans ${mailboxLabel}…`;
    return "Rechercher dans toutes les boîtes…";
  }, [mailboxLabel]);

  useEffect(() => {
    const q = query.trim();
    const anyFilter = filters.attachment || filters.recent || filters.fromMe || filters.unread;
    if (q.length < 2 && !anyFilter) {
      setResults([]);
      setSearching(false);
      return;
    }

    const myId = ++reqIdRef.current;
    setSearching(true);

    const timer = setTimeout(() => {
      supabase
        .rpc("search_inbox", {
          p_query: q,
          p_mailbox_id: mailboxId ?? undefined,
          p_has_attachment: filters.attachment,
          p_since: filters.recent ? new Date(Date.now() - 7 * 86400_000).toISOString() : undefined,
          p_from_me: filters.fromMe,
          p_unread_only: filters.unread,
          p_limit: 8,
        })
        .then((r) => {
          if (reqIdRef.current !== myId) return;
          if (!r.error && r.data) setResults(r.data as SearchRow[]);
          setSearching(false);
        });
    }, 120);

    return () => clearTimeout(timer);
  }, [query, mailboxId, filters]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setFilters({ attachment: false, recent: false, fromMe: false, unread: false });
    }
  }, [open]);

  const handleSelect = (conversationId: string) => {
    onSelect(conversationId);
    onOpenChange(false);
  };

  const goToFullResults = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (mailboxId) params.set("mailbox", mailboxId);
    const activeFilters = Object.entries(filters).filter(([, v]) => v).map(([k]) => k);
    if (activeFilters.length) params.set("filters", activeFilters.join(","));
    onOpenChange(false);
    navigate(`/search?${params.toString()}`);
  };

  const toggle = (k: FilterKey) =>
    setFilters((f) => ({ ...f, [k]: !f[k] }));

  const chips: { key: FilterKey; label: string }[] = [
    { key: "attachment", label: "Pièce jointe" },
    { key: "recent", label: "7 derniers jours" },
    { key: "fromMe", label: "De moi" },
    { key: "unread", label: "Non lus" },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder={placeholder}
        value={query}
        onValueChange={setQuery}
      />
      <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => toggle(c.key)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors",
              filters[c.key]
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <CommandList className="max-h-[420px]">
        <CommandEmpty>
          {searching ? "Recherche…" : query.length < 2 ? "Tapez au moins 2 caractères" : "Aucun résultat"}
        </CommandEmpty>

        {results.length > 0 && (
          <CommandGroup heading={mailboxLabel ? `Dans ${mailboxLabel}` : "Conversations"}>
            {results.map((r) => {
              const subject = r.subject || "(sans sujet)";
              const sender = r.from_name || r.from_email || "";
              const sub = r.snippet || sender;
              return (
                <CommandItem
                  key={r.conversation_id}
                  value={`conv-${r.conversation_id}-${subject}`}
                  onSelect={() => handleSelect(r.conversation_id)}
                  className="py-2"
                >
                  <Mail className={cn("mr-2 h-4 w-4 shrink-0", r.is_unread ? "text-primary" : "text-muted-foreground")} />
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("text-sm truncate", r.is_unread && "font-semibold")}>
                        {highlightMatch(subject, query.trim())}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground truncate">
                      {highlightMatch(sub, query.trim())}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 shrink-0 text-xs text-muted-foreground">
                    {r.has_attachment && <Paperclip className="h-3 w-3" />}
                    <span>{formatDate(r.last_message_at)}</span>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {query.trim().length >= 2 && (
          <CommandGroup>
            <CommandItem
              value="__see_all__"
              onSelect={goToFullResults}
              className="text-sm text-primary"
            >
              <Search className="mr-2 h-4 w-4" />
              Tous les résultats pour « {query.trim()} »
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
