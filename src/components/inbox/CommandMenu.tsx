import { useState, useEffect, useCallback } from "react";
import { CommandDialog, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Mail, MessageSquare } from "lucide-react";
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
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data, error } = await supabase.rpc("search_inbox", {
      p_query: q.trim(),
      p_limit: 20,
    });
    if (!error && data) {
      setResults(data as SearchResult[]);
    }
    setSearching(false);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const conversations = results.filter((r) => r.result_type === "conversation");
  const messages = results.filter((r) => r.result_type === "message");

  const handleSelect = (conversationId: string) => {
    onSelect(conversationId);
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Rechercher dans les mails…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searching ? "Recherche…" : query.length < 2 ? "Tapez au moins 2 caractères" : "Aucun résultat"}
        </CommandEmpty>

        {conversations.length > 0 && (
          <CommandGroup heading="Conversations">
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
          <CommandGroup heading="Messages">
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
      </CommandList>
    </CommandDialog>
  );
}
