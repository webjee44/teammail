import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Mail, MessageSquare, Phone, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type SearchResult = {
  result_type: string;
  id: string;
  conversation_id: string;
  label: string;
  subtitle: string;
};

type ContactResult = {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (conversationId: string) => void;
};

export function CommandMenu({ open, onOpenChange, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [contactResults, setContactResults] = useState<ContactResult[]>([]);
  const [waResults, setWaResults] = useState<{ id: string; phone_number: string; contact_name: string | null; last_message: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const reqIdRef = useRef(0);
  const cacheRef = useRef<Map<string, { inbox: SearchResult[]; contacts: ContactResult[]; wa: any[] }>>(new Map());

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setContactResults([]);
      setWaResults([]);
      setSearching(false);
      return;
    }

    // Cache hit → instantané
    const cached = cacheRef.current.get(q);
    if (cached) {
      setResults(cached.inbox);
      setContactResults(cached.contacts);
      setWaResults(cached.wa);
      setSearching(false);
      return;
    }

    const myId = ++reqIdRef.current;
    setSearching(true);

    const timer = setTimeout(() => {
      const like = `%${q}%`;

      // Stream chaque réponse dès qu'elle arrive (au lieu d'attendre Promise.all)
      const tmp: { inbox: SearchResult[]; contacts: ContactResult[]; wa: any[] } = {
        inbox: [], contacts: [], wa: [],
      };
      let pending = 3;
      const done = () => {
        if (--pending === 0 && reqIdRef.current === myId) {
          cacheRef.current.set(q, tmp);
          if (cacheRef.current.size > 50) {
            const firstKey = cacheRef.current.keys().next().value;
            if (firstKey) cacheRef.current.delete(firstKey);
          }
          setSearching(false);
        }
      };

      supabase.rpc("search_inbox", { p_query: q, p_limit: 12 }).then((r) => {
        if (reqIdRef.current === myId && !r.error && r.data) {
          tmp.inbox = r.data as SearchResult[];
          setResults(tmp.inbox);
        }
        done();
      });

      supabase
        .from("contacts")
        .select("id, name, email, company")
        .or(`name.ilike.${like},email.ilike.${like},company.ilike.${like}`)
        .order("updated_at", { ascending: false })
        .limit(8)
        .then((r) => {
          if (reqIdRef.current === myId && !r.error && r.data) {
            tmp.contacts = r.data;
            setContactResults(tmp.contacts);
          }
          done();
        });

      supabase
        .from("whatsapp_conversations")
        .select("id, phone_number, contact_name, last_message")
        .or(`contact_name.ilike.${like},phone_number.ilike.${like},last_message.ilike.${like}`)
        .order("last_message_at", { ascending: false })
        .limit(8)
        .then((r) => {
          if (reqIdRef.current === myId && !r.error && r.data) {
            tmp.wa = r.data;
            setWaResults(tmp.wa);
          }
          done();
        });
    }, 120);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setContactResults([]);
      setWaResults([]);
    }
  }, [open]);

  const conversations = results.filter((r) => r.result_type === "conversation");
  const messages = results.filter((r) => r.result_type === "message");

  const handleSelect = (conversationId: string) => {
    onSelect(conversationId);
    onOpenChange(false);
  };

  const handleSelectContact = (contactId: string) => {
    onOpenChange(false);
    navigate(`/contacts?highlight=${contactId}`);
  };

  const handleSelectWA = (waConvId: string) => {
    onOpenChange(false);
    navigate(`/whatsapp?id=${waConvId}`);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Rechercher partout…"
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

        {contactResults.length > 0 && (
          <CommandGroup heading="Contacts">
            {contactResults.map((c) => (
              <CommandItem
                key={c.id}
                value={`contact-${c.id}-${c.name || c.email}`}
                onSelect={() => handleSelectContact(c.id)}
              >
                <User className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm truncate">{c.name || c.email}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {c.email}{c.company ? ` · ${c.company}` : ""}
                  </span>
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
