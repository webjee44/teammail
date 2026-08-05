import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { highlightMatch } from "@/components/inbox/CommandMenu";
import { Mail, Paperclip, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Row = {
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

const FILTER_KEYS = ["attachment", "recent", "fromMe", "unread"] as const;
type FilterKey = typeof FILTER_KEYS[number];

const CHIPS: { key: FilterKey; label: string }[] = [
  { key: "attachment", label: "Pièce jointe" },
  { key: "recent", label: "7 derniers jours" },
  { key: "fromMe", label: "De moi" },
  { key: "unread", label: "Non lus" },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function SearchResults() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") || "";
  const mailboxId = params.get("mailbox");
  const filtersStr = params.get("filters") || "";

  const filters = useMemo(() => {
    const set = new Set(filtersStr.split(",").filter(Boolean));
    return Object.fromEntries(FILTER_KEYS.map((k) => [k, set.has(k)])) as Record<FilterKey, boolean>;
  }, [filtersStr]);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mailboxLabel, setMailboxLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!mailboxId) { setMailboxLabel(null); return; }
    supabase.from("team_mailboxes").select("label, email").eq("id", mailboxId).maybeSingle()
      .then(({ data }) => { if (data) setMailboxLabel(data.label || data.email); });
  }, [mailboxId]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    supabase.rpc("search_inbox", {
      p_query: q,
      p_mailbox_id: mailboxId ?? null,
      p_has_attachment: filters.attachment,
      p_since: filters.recent ? new Date(Date.now() - 7 * 86400_000).toISOString() : null,
      p_from_me: filters.fromMe,
      p_unread_only: filters.unread,
      p_limit: 100,
    }).then(({ data, error }) => {
      if (error) {
        console.error("search_inbox failed:", error);
        setError(error.message);
        setRows([]);
      } else {
        setRows((data || []) as Row[]);
      }
      setLoading(false);
    });
  }, [q, mailboxId, filters]);

  const toggleFilter = (k: FilterKey) => {
    const next = new Set(Object.entries({ ...filters, [k]: !filters[k] }).filter(([, v]) => v).map(([key]) => key));
    const p = new URLSearchParams(params);
    if (next.size) p.set("filters", Array.from(next).join(","));
    else p.delete("filters");
    setParams(p);
  };

  const openConversation = (id: string) => {
    const p = new URLSearchParams();
    if (mailboxId) p.set("mailbox", mailboxId);
    navigate(`/?${p.toString()}#conv-${id}`);
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        <div className="border-b px-6 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour
            </Button>
            <h1 className="text-lg font-semibold">
              Résultats pour « {q} »
              {mailboxLabel && <span className="text-muted-foreground font-normal"> dans {mailboxLabel}</span>}
            </h1>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CHIPS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleFilter(c.key)}
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
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Recherche…</div>
          ) : error ? (
            <div className="p-6 text-sm text-destructive">
              La recherche a échoué : {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Aucun résultat</div>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => {
                const subject = r.subject || "(sans sujet)";
                const sender = r.from_name || r.from_email || "";
                return (
                  <li
                    key={r.conversation_id}
                    onClick={() => openConversation(r.conversation_id)}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 cursor-pointer"
                  >
                    <Mail className={cn("h-4 w-4 shrink-0", r.is_unread ? "text-primary" : "text-muted-foreground")} />
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-sm truncate", r.is_unread && "font-semibold")}>
                        {highlightMatch(subject, q)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {sender} {r.snippet && <>· {highlightMatch(r.snippet, q)}</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                      {r.has_attachment && <Paperclip className="h-3 w-3" />}
                      <span>{formatDate(r.last_message_at)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
