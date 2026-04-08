import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Search,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  User,
  Building2,
  Mail,
  Phone,
  MessageSquare,
  Merge,
  Loader2,
  ArrowRight,
  Tag,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Contact = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  avatar_url: string | null;
  notes: string | null;
  salesperson: string | null;
  created_at: string;
  conversation_count?: number;
  last_interaction?: string | null;
};

type TagType = {
  id: string;
  name: string;
  color: string;
};

const Contacts = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", email: "", company: "", phone: "" });
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tags state
  const [tags, setTags] = useState<TagType[]>([]);
  const [contactTags, setContactTags] = useState<Record<string, string[]>>({}); // contact_id -> tag_id[]
  const [filterTagId, setFilterTagId] = useState<string | null>(null);

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contacts_with_stats" as any)
      .select("*")
      .order("name", { ascending: true, nullsFirst: false });

    if (error) {
      toast.error("Erreur lors du chargement des contacts");
      setLoading(false);
      return;
    }

    setContacts(
      (data || []).map((c: any) => ({
        id: c.id,
        email: c.email,
        name: c.name,
        company: c.company,
        phone: c.phone,
        avatar_url: c.avatar_url,
        notes: c.notes,
        salesperson: c.salesperson ?? null,
        created_at: c.created_at,
        conversation_count: c.conversation_count ?? 0,
        last_interaction: c.last_interaction ?? null,
      }))
    );
    setLoading(false);
  }, []);

  const fetchTags = useCallback(async () => {
    const { data } = await supabase.from("tags").select("id, name, color").order("name");
    if (data) setTags(data);
  }, []);

  const fetchContactTags = useCallback(async () => {
    const { data } = await supabase.from("contact_tags").select("contact_id, tag_id");
    if (data) {
      const map: Record<string, string[]> = {};
      data.forEach((ct: any) => {
        if (!map[ct.contact_id]) map[ct.contact_id] = [];
        map[ct.contact_id].push(ct.tag_id);
      });
      setContactTags(map);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
    fetchTags();
    fetchContactTags();
  }, [fetchContacts, fetchTags, fetchContactTags]);

  const handleCreate = async () => {
    if (!newContact.email.trim()) {
      toast.error("L'email est obligatoire");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("user_id", user?.id ?? "")
      .single();

    if (!profile?.team_id) {
      toast.error("Aucune équipe trouvée");
      return;
    }

    const { error } = await supabase.from("contacts").insert({
      team_id: profile.team_id,
      email: newContact.email.trim(),
      name: newContact.name.trim() || null,
      company: newContact.company.trim() || null,
      phone: newContact.phone.trim() || null,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("Un contact avec cet email existe déjà");
      } else {
        toast.error("Erreur : " + error.message);
      }
      return;
    }

    toast.success("Contact créé");
    setCreateOpen(false);
    setNewContact({ name: "", email: "", company: "", phone: "" });
    fetchContacts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success("Contact supprimé");
    if (selectedContact?.id === id) setSelectedContact(null);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const assignTagToSelected = async (tagId: string) => {
    const ids = Array.from(selectedIds);
    const toInsert = ids
      .filter((cid) => !(contactTags[cid] || []).includes(tagId))
      .map((cid) => ({ contact_id: cid, tag_id: tagId }));

    if (toInsert.length > 0) {
      const { error } = await supabase.from("contact_tags").insert(toInsert);
      if (error) {
        toast.error("Erreur : " + error.message);
        return;
      }
    }
    toast.success(`Tag appliqué à ${ids.length} contact(s)`);
    setTagPopoverOpen(false);
    setSelectionMode(false);
    setSelectedIds(new Set());
    fetchContactTags();
  };

  const createAndAssignTag = async () => {
    if (!newTagName.trim()) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("user_id", user?.id ?? "")
      .single();
    if (!profile?.team_id) return;

    const { data: tag, error } = await supabase
      .from("tags")
      .insert({ team_id: profile.team_id, name: newTagName.trim() })
      .select()
      .single();
    if (error || !tag) {
      toast.error("Erreur : " + (error?.message || "Inconnu"));
      return;
    }
    setNewTagName("");
    await fetchTags();
    await assignTagToSelected(tag.id);
  };

  const deleteTag = async (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId);
    if (!tag) return;
    if (!confirm(`Supprimer le tag "${tag.name}" ? Il sera retiré de tous les contacts.`)) return;
    const { error } = await supabase.from("tags").delete().eq("id", tagId);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success(`Tag "${tag.name}" supprimé`);
    if (filterTagId === tagId) setFilterTagId(null);
    fetchTags();
    fetchContactTags();
  };

  const getTagById = (id: string) => tags.find((t) => t.id === id);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.email.toLowerCase().includes(q) ||
      (c.name?.toLowerCase().includes(q) ?? false) ||
      (c.company?.toLowerCase().includes(q) ?? false);

    if (filterTagId) {
      const cTags = contactTags[c.id] || [];
      return matchesSearch && cTags.includes(filterTagId);
    }
    return matchesSearch;
  });

  const getInitials = (c: Contact) =>
    c.name
      ? c.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
      : c.email.slice(0, 2).toUpperCase();

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-3rem)] w-full">
        {/* Contact list */}
        <div className="w-[400px] border-r border-border flex flex-col shrink-0">
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Contacts {!loading && <span className="text-muted-foreground font-normal">({filtered.length})</span>}
              </h2>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={selectionMode ? "secondary" : "outline"}
                  className="h-7 gap-1 text-xs"
                  onClick={() => {
                    setSelectionMode(!selectionMode);
                    setSelectedIds(new Set());
                  }}
                >
                  <Check className="h-3 w-3" />
                  {selectionMode ? "Annuler" : "Sélectionner"}
                </Button>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-7 gap-1">
                      <Plus className="h-3.5 w-3.5" /> Nouveau
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nouveau contact</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 mt-2">
                      <div>
                        <Label className="text-xs">Email *</Label>
                        <Input
                          value={newContact.email}
                          onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                          placeholder="contact@example.com"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Nom</Label>
                        <Input
                          value={newContact.name}
                          onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                          placeholder="Jean Dupont"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Entreprise</Label>
                        <Input
                          value={newContact.company}
                          onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                          placeholder="Acme Inc."
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Téléphone</Label>
                        <Input
                          value={newContact.phone}
                          onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                          placeholder="+33 6 00 00 00 00"
                        />
                      </div>
                      <Button onClick={handleCreate} className="w-full">Créer le contact</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un contact..."
                className="pl-8 h-8 text-sm"
              />
            </div>

            {/* Tag filter chips */}
            {tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {tags.map((tag) => (
                  <div key={tag.id} className="group/tag inline-flex items-center gap-0.5">
                    <button
                      onClick={() => setFilterTagId(filterTagId === tag.id ? null : tag.id)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-l-full text-[10px] font-medium border transition-colors ${
                        filterTagId === tag.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                      {filterTagId === tag.id && <X className="h-2.5 w-2.5" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTag(tag.id); }}
                      className={`inline-flex items-center px-1 py-0.5 rounded-r-full text-[10px] border border-l-0 transition-colors opacity-0 group-hover/tag:opacity-100 ${
                        filterTagId === tag.id
                          ? "bg-primary text-primary-foreground border-primary hover:bg-destructive hover:border-destructive"
                          : "bg-muted/50 text-muted-foreground border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                      }`}
                      title={`Supprimer le tag "${tag.name}"`}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bulk action bar */}
            {selectionMode && selectedIds.size > 0 && (
              <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-md border border-primary/20">
                <span className="text-xs font-medium text-primary">{selectedIds.size} sélectionné(s)</span>
                <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="h-6 text-xs gap-1 ml-auto">
                      <Tag className="h-3 w-3" /> Ajouter un tag
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
                    <div className="space-y-1 max-h-40 overflow-auto">
                      {tags.map((tag) => (
                        <button
                          key={tag.id}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors"
                          onClick={() => assignTagToSelected(tag.id)}
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                        </button>
                      ))}
                    </div>
                    <Separator className="my-1.5" />
                    <div className="flex gap-1">
                      <Input
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Nouveau tag…"
                        className="h-7 text-xs"
                        onKeyDown={(e) => e.key === "Enter" && createAndAssignTag()}
                      />
                      <Button size="sm" variant="secondary" className="h-7 text-xs shrink-0" onClick={createAndAssignTag} disabled={!newTagName.trim()}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center p-8 text-sm text-muted-foreground">
                Aucun contact trouvé
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
                      selectedContact?.id === c.id ? "bg-muted" : ""
                    }`}
                    onClick={() => {
                      if (selectionMode) {
                        toggleSelection(c.id);
                      } else {
                        setSelectedContact(c);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {selectionMode && (
                        <Checkbox
                          checked={selectedIds.has(c.id)}
                          onCheckedChange={() => toggleSelection(c.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={c.avatar_url || undefined} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(c)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {c.name || c.email}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {c.company && <span className="truncate">{c.company}</span>}
                          {c.salesperson && (
                            <>
                              {c.company && <span>·</span>}
                              <span className="truncate text-primary/70">{c.salesperson}</span>
                            </>
                          )}
                          {(c.company || c.salesperson) && c.conversation_count !== undefined && <span>·</span>}
                          <span className="flex items-center gap-0.5 shrink-0">
                            <MessageSquare className="h-3 w-3" />
                            {c.conversation_count}
                          </span>
                        </div>
                        {/* Contact tags */}
                        {(contactTags[c.id] || []).length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {(contactTags[c.id] || []).map((tagId) => {
                              const tag = getTagById(tagId);
                              if (!tag) return null;
                              return (
                                <span
                                  key={tagId}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[9px] font-medium"
                                  style={{ backgroundColor: tag.color + "20", color: tag.color }}
                                >
                                  {tag.name}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {!selectionMode && c.last_interaction && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {format(new Date(c.last_interaction), "d MMM", { locale: fr })}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Detail panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedContact ? (
            <ContactDetailView
              contact={selectedContact}
              allContacts={contacts}
              tags={tags}
              contactTags={contactTags[selectedContact.id] || []}
              onDelete={handleDelete}
              onUpdate={() => { fetchContacts(); fetchContactTags(); }}
              onTagsChange={() => { fetchTags(); fetchContactTags(); }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <User className="h-12 w-12 mx-auto opacity-30" />
                <p className="text-sm">Sélectionnez un contact</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

function ContactDetailView({
  contact,
  allContacts,
  tags,
  contactTags: cTags,
  onDelete,
  onUpdate,
  onTagsChange,
}: {
  contact: Contact;
  allContacts: Contact[];
  tags: TagType[];
  contactTags: string[];
  onDelete: (id: string) => void;
  onUpdate: () => void;
  onTagsChange: () => void;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldValue, setFieldValue] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(contact.notes || "");
  const [pastConvos, setPastConvos] = useState<{ id: string; subject: string; status: string; last_message_at: string }[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeTarget, setMergeTarget] = useState<Contact | null>(null);
  const [merging, setMerging] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    setNotesValue(contact.notes || "");
    setEditingField(null);
    setEditingNotes(false);

    const fetchConvos = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, subject, status, last_message_at")
        .eq("from_email", contact.email)
        .order("last_message_at", { ascending: false })
        .limit(20);
      setPastConvos(data || []);
    };
    fetchConvos();
  }, [contact.id, contact.email, contact.notes]);

  const handleMerge = async () => {
    if (!mergeTarget) return;
    setMerging(true);
    try {
      const { data, error } = await supabase.functions.invoke("merge-contacts", {
        body: { primary_id: contact.id, secondary_id: mergeTarget.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Contact ${mergeTarget.email} fusionné avec succès`);
      setMergeOpen(false);
      setMergeTarget(null);
      setMergeSearch("");
      onUpdate();
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || String(err)));
    } finally {
      setMerging(false);
    }
  };

  const addTag = async (tagId: string) => {
    if (cTags.includes(tagId)) return;
    const { error } = await supabase.from("contact_tags").insert({ contact_id: contact.id, tag_id: tagId });
    if (error) { toast.error("Erreur"); return; }
    onTagsChange();
  };

  const removeTag = async (tagId: string) => {
    const { error } = await supabase.from("contact_tags").delete().eq("contact_id", contact.id).eq("tag_id", tagId);
    if (error) { toast.error("Erreur"); return; }
    onTagsChange();
  };

  const createAndAddTag = async () => {
    if (!newTagName.trim()) return;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("user_id", user?.id ?? "").single();
    if (!profile?.team_id) return;
    const { data: tag, error } = await supabase.from("tags").insert({ team_id: profile.team_id, name: newTagName.trim() }).select().single();
    if (error || !tag) { toast.error("Erreur"); return; }
    setNewTagName("");
    onTagsChange();
    await addTag(tag.id);
  };

  const mergeableContacts = allContacts.filter(
    (c) => c.id !== contact.id && (
      c.email.toLowerCase().includes(mergeSearch.toLowerCase()) ||
      (c.name?.toLowerCase().includes(mergeSearch.toLowerCase()) ?? false)
    )
  );

  const saveField = async (field: string, value: string) => {
    const { error } = await supabase
      .from("contacts")
      .update({ [field]: value || null })
      .eq("id", contact.id);
    if (error) { toast.error("Erreur"); return; }
    setEditingField(null);
    onUpdate();
    toast.success("Mis à jour");
  };

  const saveNotes = async () => {
    const { error } = await supabase
      .from("contacts")
      .update({ notes: notesValue })
      .eq("id", contact.id);
    if (error) { toast.error("Erreur"); return; }
    setEditingNotes(false);
    onUpdate();
    toast.success("Notes mises à jour");
  };

  const initials = contact.name
    ? contact.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : contact.email.slice(0, 2).toUpperCase();

  const EditableRow = ({ icon: Icon, field, value, label }: { icon: any; field: string; value: string | null; label: string }) => (
    <div className="flex items-center gap-3 py-2.5">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      {editingField === field ? (
        <div className="flex items-center gap-1 flex-1">
          <Input
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            className="h-7 text-sm"
            autoFocus
          />
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveField(field, fieldValue)}>
            <Check className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingField(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <span
          className="text-sm text-foreground cursor-pointer hover:text-primary transition-colors flex-1 truncate"
          onClick={() => { setEditingField(field); setFieldValue(value || ""); }}
        >
          {value || "—"}
        </span>
      )}
    </div>
  );

  return (
    <ScrollArea className="flex-1">
      <div className="max-w-2xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={contact.avatar_url || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xl">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-foreground">{contact.name || contact.email}</h1>
            {contact.name && <p className="text-sm text-muted-foreground">{contact.email}</p>}
            {contact.company && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="h-3.5 w-3.5" /> {contact.company}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Dialog open={mergeOpen} onOpenChange={(open) => { setMergeOpen(open); if (!open) { setMergeTarget(null); setMergeSearch(""); } }}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Fusionner avec un autre contact">
                  <Merge className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Fusionner les contacts</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Sélectionnez le contact à fusionner dans <strong>{contact.name || contact.email}</strong>.
                  Ses conversations et informations seront transférées.
                </p>

                <div className="relative mt-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={mergeSearch}
                    onChange={(e) => setMergeSearch(e.target.value)}
                    placeholder="Rechercher le contact à fusionner..."
                    className="pl-8 h-8 text-sm"
                  />
                </div>

                <ScrollArea className="max-h-[200px] border rounded-md">
                  {mergeableContacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucun contact trouvé</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {mergeableContacts.slice(0, 20).map((c) => (
                        <button
                          key={c.id}
                          className={`w-full text-left p-2.5 hover:bg-muted/50 transition-colors ${mergeTarget?.id === c.id ? "bg-primary/10" : ""}`}
                          onClick={() => setMergeTarget(c)}
                        >
                          <p className="text-sm font-medium truncate">{c.name || c.email}</p>
                          {c.name && <p className="text-xs text-muted-foreground">{c.email}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {mergeTarget && (
                  <div className="border rounded-md p-3 bg-muted/30 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Aperçu de la fusion</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{mergeTarget.name || mergeTarget.email}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-primary">{contact.name || contact.email}</span>
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {!contact.name && mergeTarget.name && <li>+ Nom : {mergeTarget.name}</li>}
                      {!contact.company && mergeTarget.company && <li>+ Entreprise : {mergeTarget.company}</li>}
                      {!contact.phone && mergeTarget.phone && <li>+ Téléphone : {mergeTarget.phone}</li>}
                      <li>Conversations de {mergeTarget.email} → transférées</li>
                      <li className="text-destructive">{mergeTarget.email} sera supprimé</li>
                    </ul>
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="outline" onClick={() => setMergeOpen(false)}>Annuler</Button>
                  <Button
                    onClick={handleMerge}
                    disabled={!mergeTarget || merging}
                    className="gap-2"
                  >
                    {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
                    Fusionner
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(contact.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator className="my-2" />

        {/* Tags section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tags</h3>
            <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Ajouter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="space-y-1 max-h-40 overflow-auto">
                  {tags.filter((t) => !cTags.includes(t.id)).map((tag) => (
                    <button
                      key={tag.id}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors"
                      onClick={() => { addTag(tag.id); setTagPopoverOpen(false); }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </button>
                  ))}
                  {tags.filter((t) => !cTags.includes(t.id)).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-1">Tous les tags sont déjà attribués</p>
                  )}
                </div>
                <Separator className="my-1.5" />
                <div className="flex gap-1">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Nouveau tag…"
                    className="h-7 text-xs"
                    onKeyDown={(e) => e.key === "Enter" && createAndAddTag()}
                  />
                  <Button size="sm" variant="secondary" className="h-7 text-xs shrink-0" onClick={createAndAddTag} disabled={!newTagName.trim()}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {cTags.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun tag</p>
            ) : (
              cTags.map((tagId) => {
                const tag = tags.find((t) => t.id === tagId);
                if (!tag) return null;
                return (
                  <Badge
                    key={tagId}
                    variant="secondary"
                    className="text-[10px] h-5 gap-1 pl-1.5"
                    style={{ backgroundColor: tag.color + "20", color: tag.color, borderColor: tag.color + "40" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                    <button onClick={() => removeTag(tagId)} className="hover:opacity-70 ml-0.5">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                );
              })
            )}
          </div>
        </div>

        <Separator className="my-2" />

        {/* Editable fields */}
        <div className="space-y-1">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Informations</h3>
          <EditableRow icon={User} field="name" value={contact.name} label="Nom" />
          <EditableRow icon={Mail} field="email" value={contact.email} label="Email" />
          <EditableRow icon={Building2} field="company" value={contact.company} label="Entreprise" />
          <EditableRow icon={Phone} field="phone" value={contact.phone} label="Téléphone" />
          <EditableRow icon={User} field="salesperson" value={contact.salesperson} label="Commercial" />
        </div>

        <Separator className="my-2" />

        {/* Notes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes partagées</h3>
            {!editingNotes && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingNotes(true)}>
                <Edit3 className="h-3 w-3" />
              </Button>
            )}
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <Textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                className="min-h-[80px] text-sm resize-none"
                autoFocus
              />
              <div className="flex gap-1 justify-end">
                <Button size="sm" variant="ghost" onClick={() => { setEditingNotes(false); setNotesValue(contact.notes || ""); }}>
                  Annuler
                </Button>
                <Button size="sm" onClick={saveNotes}>Sauver</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes || "Aucune note"}</p>
          )}
        </div>

        <Separator className="my-2" />

        {/* Conversations */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Conversations ({pastConvos.length})
          </h3>
          <div className="space-y-2">
            {pastConvos.map((conv) => (
              <button
                key={conv.id}
                className="w-full text-left p-2.5 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                onClick={() => navigate(`/?selected=${conv.id}`)}
              >
                <p className="text-sm font-medium text-foreground truncate">{conv.subject}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {conv.status === "open" ? "Ouvert" : conv.status === "snoozed" ? "Pause" : "Fermé"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(conv.last_message_at), "d MMM yyyy", { locale: fr })}
                  </span>
                </div>
              </button>
            ))}
            {pastConvos.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">Aucune conversation</p>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

export default Contacts;
