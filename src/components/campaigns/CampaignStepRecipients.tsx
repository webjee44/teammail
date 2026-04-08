import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, X, Tag } from "lucide-react";
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

type TagType = {
  id: string;
  name: string;
  color: string;
  count: number;
};

export function CampaignStepRecipients({ data, onChange }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<TagType[]>([]);
  const [contactTagMap, setContactTagMap] = useState<Record<string, string[]>>({}); // contact_id -> tag_id[]
  const [filterTagId, setFilterTagId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const [contactsRes, tagsRes, ctRes] = await Promise.all([
        supabase.from("contacts").select("id, email, name, company, phone").order("name"),
        supabase.from("tags").select("id, name, color").order("name"),
        supabase.from("contact_tags").select("contact_id, tag_id"),
      ]);

      if (contactsRes.data) setContacts(contactsRes.data);

      // Build contact-tag map
      const map: Record<string, string[]> = {};
      (ctRes.data || []).forEach((ct: any) => {
        if (!map[ct.contact_id]) map[ct.contact_id] = [];
        map[ct.contact_id].push(ct.tag_id);
      });
      setContactTagMap(map);

      // Build tags with count
      const tagCounts: Record<string, number> = {};
      (ctRes.data || []).forEach((ct: any) => {
        tagCounts[ct.tag_id] = (tagCounts[ct.tag_id] || 0) + 1;
      });

      if (tagsRes.data) {
        setTags(
          tagsRes.data
            .map((t: any) => ({ ...t, count: tagCounts[t.id] || 0 }))
            .filter((t: TagType) => t.count > 0)
        );
      }

      setLoading(false);
    };
    loadData();
  }, []);

  const selectedEmails = new Set(data.recipients.map((r) => r.email));

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.email.toLowerCase().includes(q) ||
      (c.name?.toLowerCase().includes(q)) ||
      (c.company?.toLowerCase().includes(q));

    if (filterTagId) {
      const cTags = contactTagMap[c.id] || [];
      return matchesSearch && cTags.includes(filterTagId);
    }
    return matchesSearch;
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
    const existing = new Map(data.recipients.map((r) => [r.email, r]));
    all.forEach((r) => existing.set(r.email, r));
    onChange({ ...data, recipients: Array.from(existing.values()) });
  };

  const selectByTag = (tagId: string) => {
    const tagContacts = contacts.filter((c) => (contactTagMap[c.id] || []).includes(tagId));
    const toAdd: Recipient[] = tagContacts.map((c) => ({
      contact_id: c.id,
      email: c.email,
      name: c.name || "",
      company: c.company || "",
    }));
    const existing = new Map(data.recipients.map((r) => [r.email, r]));
    toAdd.forEach((r) => existing.set(r.email, r));
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

      {/* Tag filter chips */}
      {tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          <Tag className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => {
                if (filterTagId === tag.id) {
                  setFilterTagId(null);
                } else {
                  setFilterTagId(tag.id);
                  selectByTag(tag.id);
                }
              }}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                filterTagId === tag.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: filterTagId === tag.id ? "currentColor" : tag.color }} />
              {tag.name}
              <span className="opacity-60">({tag.count})</span>
              {filterTagId === tag.id && <X className="h-2.5 w-2.5" />}
            </button>
          ))}
        </div>
      )}

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
                {/* Show contact tags */}
                {(contactTagMap[contact.id] || []).length > 0 && (
                  <div className="flex gap-1 shrink-0">
                    {(contactTagMap[contact.id] || []).slice(0, 2).map((tagId) => {
                      const tag = tags.find((t) => t.id === tagId);
                      if (!tag) return null;
                      return (
                        <span
                          key={tagId}
                          className="inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium"
                          style={{ backgroundColor: tag.color + "20", color: tag.color }}
                        >
                          {tag.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </label>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
