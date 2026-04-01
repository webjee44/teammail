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
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  created_at: string;
  conversation_count?: number;
  last_interaction?: string | null;
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

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("name", { ascending: true, nullsFirst: false });

    if (error) {
      toast.error("Erreur lors du chargement des contacts");
      setLoading(false);
      return;
    }

    // Enrich with conversation counts
    const enriched: Contact[] = [];
    for (const c of data || []) {
      const { count } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("from_email", c.email);

      const { data: lastConv } = await supabase
        .from("conversations")
        .select("last_message_at")
        .eq("from_email", c.email)
        .order("last_message_at", { ascending: false })
        .limit(1);

      enriched.push({
        ...c,
        conversation_count: count || 0,
        last_interaction: lastConv?.[0]?.last_message_at || null,
      });
    }

    setContacts(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleCreate = async () => {
    if (!newContact.email.trim()) {
      toast.error("L'email est obligatoire");
      return;
    }

    // Get team_id from profile
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

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.email.toLowerCase().includes(q) ||
      (c.name?.toLowerCase().includes(q) ?? false) ||
      (c.company?.toLowerCase().includes(q) ?? false)
    );
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
              <h2 className="text-sm font-semibold text-foreground">Contacts</h2>
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
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un contact..."
                className="pl-8 h-8 text-sm"
              />
            </div>
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
                    onClick={() => setSelectedContact(c)}
                  >
                    <div className="flex items-center gap-3">
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
                          {c.company && c.conversation_count !== undefined && <span>·</span>}
                          <span className="flex items-center gap-0.5 shrink-0">
                            <MessageSquare className="h-3 w-3" />
                            {c.conversation_count}
                          </span>
                        </div>
                      </div>
                      {c.last_interaction && (
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
              onDelete={handleDelete}
              onUpdate={() => fetchContacts()}
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
  onDelete,
  onUpdate,
}: {
  contact: Contact;
  allContacts: Contact[];
  onDelete: (id: string) => void;
  onUpdate: () => void;
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
  const navigate = useNavigate();

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
    if (error) {
      toast.error("Erreur");
      return;
    }
    setEditingField(null);
    onUpdate();
    toast.success("Mis à jour");
  };

  const saveNotes = async () => {
    const { error } = await supabase
      .from("contacts")
      .update({ notes: notesValue })
      .eq("id", contact.id);
    if (error) {
      toast.error("Erreur");
      return;
    }
    setEditingNotes(false);
    onUpdate();
    toast.success("Notes mises à jour");
  };

  const initials = contact.name
    ? contact.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : contact.email.slice(0, 2).toUpperCase();

  const EditableRow = ({ icon: Icon, field, value, label }: { icon: any; field: string; value: string | null; label: string }) => (
    <div className="flex items-center gap-3 py-2">
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
      <div className="max-w-2xl mx-auto p-6 space-y-6">
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
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive shrink-0"
            onClick={() => onDelete(contact.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <Separator />

        {/* Editable fields */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Informations</h3>
          <EditableRow icon={User} field="name" value={contact.name} label="Nom" />
          <EditableRow icon={Mail} field="email" value={contact.email} label="Email" />
          <EditableRow icon={Building2} field="company" value={contact.company} label="Entreprise" />
          <EditableRow icon={Phone} field="phone" value={contact.phone} label="Téléphone" />
        </div>

        <Separator />

        {/* Notes */}
        <div>
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

        <Separator />

        {/* Conversations */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Conversations ({pastConvos.length})
          </h3>
          <div className="space-y-1">
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
