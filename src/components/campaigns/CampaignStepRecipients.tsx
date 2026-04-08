import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, X } from "lucide-react";
import type { CampaignData, Recipient } from "@/pages/CampaignWizard";

type Props = {
  data: CampaignData;
  onChange: (data: CampaignData) => void;
};

type Contact = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
};

export function CampaignStepRecipients({ data, onChange }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("contacts").select("id, email, name, company, phone").order("name").then(({ data }) => {
      if (data) setContacts(data);
      setLoading(false);
    });
  }, []);

  const selectedEmails = new Set(data.recipients.map((r) => r.email));

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.email.toLowerCase().includes(q) ||
      (c.name?.toLowerCase().includes(q)) ||
      (c.company?.toLowerCase().includes(q))
    );
  });

  const toggleContact = (contact: Contact) => {
    if (selectedEmails.has(contact.email)) {
      onChange({
        ...data,
        recipients: data.recipients.filter((r) => r.email !== contact.email),
      });
    } else {
      onChange({
        ...data,
        recipients: [
          ...data.recipients,
          {
            contact_id: contact.id,
            email: contact.email,
            name: contact.name || "",
            company: contact.company || "",
          },
        ],
      });
    }
  };

  const selectAll = () => {
    const all: Recipient[] = filtered.map((c) => ({
      contact_id: c.id,
      email: c.email,
      name: c.name || "",
      company: c.company || "",
    }));
    // Merge with existing (avoid duplicates)
    const existing = new Map(data.recipients.map((r) => [r.email, r]));
    all.forEach((r) => existing.set(r.email, r));
    onChange({ ...data, recipients: Array.from(existing.values()) });
  };

  const clearAll = () => {
    onChange({ ...data, recipients: [] });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={selectAll}>
          Tout sélectionner
        </Button>
        {data.recipients.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X className="h-3.5 w-3.5 mr-1" />
            Effacer
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {data.recipients.length} destinataire{data.recipients.length !== 1 ? "s" : ""} sélectionné{data.recipients.length !== 1 ? "s" : ""}
        </span>
        {data.recipients.length > 0 && (
          <div className="flex gap-1 flex-wrap ml-2">
            {data.recipients.slice(0, 5).map((r) => (
              <Badge key={r.email} variant="secondary" className="text-[10px] h-5 gap-1">
                {r.name || r.email}
                <button
                  onClick={() => onChange({ ...data, recipients: data.recipients.filter((x) => x.email !== r.email) })}
                  className="hover:text-destructive"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
            {data.recipients.length > 5 && (
              <Badge variant="outline" className="text-[10px] h-5">
                +{data.recipients.length - 5}
              </Badge>
            )}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 border rounded-lg">
        <div className="divide-y">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Aucun contact trouvé</div>
          ) : (
            filtered.map((contact) => (
              <label
                key={contact.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedEmails.has(contact.email)}
                  onCheckedChange={() => toggleContact(contact)}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {contact.name || contact.email}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {contact.email}
                    {contact.company && ` · ${contact.company}`}
                  </div>
                </div>
              </label>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
