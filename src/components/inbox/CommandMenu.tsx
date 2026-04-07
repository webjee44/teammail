import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Mail, MessageSquare, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type SearchResult = {
  result_type: string;
  id: string;
  conversation_id: string;
  label: string;
  subtitle: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (conversationId: string) => void;
};

export function CommandMenu({ open, onOpenChange, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [waResults, setWaResults] = useState<{ id: string; phone_number: string; contact_name: string | null; last_message: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setWaResults([]);
      return;
    }
    setSearching(true);

    const [inboxRes, waRes] = await Promise.all([
      supabase.rpc("search_inbox", { p_query: q.trim(), p_limit: 20 }),
      supabase
        .from("whatsapp_conversations")
        .select("id, phone_number, contact_name, last_message")
        .or(`contact_name.ilike.%${q.trim()}%,phone_number.ilike.%${q.trim()}%,last_message.ilike.%${q.trim()}%`)
        .order("last_message_at", { ascending: false })
        .limit(10),
    ]);

    if (!inboxRes.error && inboxRes.data) setResults(inboxRes.data as SearchResult[]);
    if (!waRes.error && waRes.data) setWaResults(waRes.data);

    setSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setWaResults([]);
    }
  }, [open]);

  const conversations = results.filter((r) => r.result_type === "conversation");
  const messages = results.filter((r) => r.result_type === "message");

  const handleSelect = (conversationId: string) => {
    onSelect(conversationId);
    onOpenChange(false);
  };

  const handleSelectWA = (waConvId: string) => {
    onOpenChange(false);
    navigate(`/whatsapp?id=${waConvId}`);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Rechercher mails et WhatsApp…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searching ? "Recherche…" : query.length < 2 ? "Tapez au moins 2 caractères" : "Aucun résultat"}
        </CommandEmpty>

        {conversations.length > 0 && (
          <CommandGroup heading="Conversations email">
            {conversations.map((r) => (
              <CommandItem
                key={r.id}
                value={`conv-${r.id}-${r.label}`}
                onSelect={() => handleSelect(r.conversation_id)}
              >
                <Mail className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm truncate">{r.label}</span>
                  <span className="text-xs text-muted-foreground truncate">{r.subtitle}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {messages.length > 0 && (
          <CommandGroup heading="Messages email">
            {messages.map((r) => (
              <CommandItem
                key={r.id}
                value={`msg-${r.id}-${r.label}`}
                onSelect={() => handleSelect(r.conversation_id)}
              >
                <MessageSquare className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm truncate">{r.label}</span>
                  <span className="text-xs text-muted-foreground truncate">{r.subtitle}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {waResults.length > 0 && (
          <CommandGroup heading="WhatsApp">
            {waResults.map((wa) => (
              <CommandItem
                key={wa.id}
                value={`wa-${wa.id}-${wa.contact_name || wa.phone_number}`}
                onSelect={() => handleSelectWA(wa.id)}
              >
                <Phone className="mr-2 h-4 w-4 text-green-500 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm truncate">{wa.contact_name || wa.phone_number}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {wa.phone_number}{wa.last_message ? ` · ${wa.last_message.substring(0, 60)}` : ""}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
