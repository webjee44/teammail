import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  User,
  Building2,
  MapPin,
  Phone,
  Mail,
  MessageSquare,
  Edit3,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
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
  custom_fields: Record<string, string>;
  street: string | null;
  street2: string | null;
  city: string | null;
  zip: string | null;
  country: string | null;
  salesperson: string | null;
  last_synced_at: string | null;
};

type PastConversation = {
  id: string;
  subject: string;
  status: string;
  last_message_at: string;
};

type Props = {
  contactEmail: string | null;
  teamId?: string;
  onSelectConversation?: (id: string) => void;
};

export function ContactPanel({ contactEmail, onSelectConversation }: Props) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [pastConvos, setPastConvos] = useState<PastConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldValue, setFieldValue] = useState("");
  const navigate = useNavigate();

  const fetchContact = useCallback(async () => {
    if (!contactEmail) return;
    setLoading(true);

    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("email", contactEmail)
      .maybeSingle();

    if (data) {
      const c: Contact = {
        id: data.id,
        email: data.email,
        name: data.name,
        company: data.company,
        phone: data.phone,
        avatar_url: data.avatar_url,
        notes: data.notes,
        custom_fields: (data.custom_fields as Record<string, string>) || {},
        street: (data as any).street || null,
        street2: (data as any).street2 || null,
        city: (data as any).city || null,
        zip: (data as any).zip || null,
        country: (data as any).country || null,
        salesperson: (data as any).salesperson || null,
        last_synced_at: (data as any).last_synced_at || null,
      };
      setContact(c);
      setNotesValue(c.notes || "");

      // Fetch past conversations via contact_conversations
      const { data: ccData } = await supabase
        .from("contact_conversations")
        .select("conversation_id")
        .eq("contact_id", c.id);

      if (ccData && ccData.length > 0) {
        const convIds = ccData.map((cc) => cc.conversation_id);
        const { data: convos } = await supabase
          .from("conversations")
          .select("id, subject, status, last_message_at")
          .in("id", convIds)
          .order("last_message_at", { ascending: false })
          .limit(10);
        setPastConvos(convos || []);
      } else {
        // Fallback: search by from_email
        const { data: convos } = await supabase
          .from("conversations")
          .select("id, subject, status, last_message_at")
          .eq("from_email", contactEmail)
          .order("last_message_at", { ascending: false })
          .limit(10);
        setPastConvos(convos || []);
      }
    } else {
      setContact(null);
      setPastConvos([]);
    }
    setLoading(false);
  }, [contactEmail]);

  useEffect(() => {
    fetchContact();
  }, [fetchContact]);

  const saveNotes = async () => {
    if (!contact) return;
    const { error } = await supabase
      .from("contacts")
      .update({ notes: notesValue })
      .eq("id", contact.id);
    if (error) {
      toast.error("Erreur lors de la sauvegarde");
    } else {
      setContact({ ...contact, notes: notesValue });
      setEditingNotes(false);
      toast.success("Notes mises à jour");
    }
  };

  const saveField = async (field: string, value: string) => {
    if (!contact) return;
    const { error } = await supabase
      .from("contacts")
      .update({ [field]: value })
      .eq("id", contact.id);
    if (error) {
      toast.error("Erreur lors de la sauvegarde");
    } else {
      setContact({ ...contact, [field]: value });
      setEditingField(null);
      toast.success("Contact mis à jour");
    }
  };

  if (!contactEmail) return null;

  if (loading) {
    return (
      <div className="w-full border-border p-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="w-full border-border p-4">
        <div className="text-center space-y-2 py-8">
          <User className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">{contactEmail}</p>
          <p className="text-xs text-muted-foreground">Aucune fiche contact</p>
        </div>
      </div>
    );
  }

  const initials = contact.name
    ? contact.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : contact.email.slice(0, 2).toUpperCase();

  const statusColors: Record<string, string> = {
    open: "text-green-600",
    snoozed: "text-amber-500",
    closed: "text-muted-foreground",
  };

  return (
    <div className="w-[280px] border-l border-border flex flex-col h-full">
      <div className="p-4 text-center space-y-2 border-b border-border">
        <Avatar className="h-14 w-14 mx-auto">
          <AvatarImage src={contact.avatar_url || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground text-lg">
            {initials}
          </AvatarFallback>
        </Avatar>
        {editingField === "name" ? (
          <div className="flex items-center gap-1">
            <Input
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              className="h-7 text-sm"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveField("name", fieldValue)}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingField(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <p
            className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
            onClick={() => { setEditingField("name"); setFieldValue(contact.name || ""); }}
          >
            {contact.name || "Sans nom"}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{contact.email}</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {editingField === "company" ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    className="h-6 text-xs"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => saveField("company", fieldValue)}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingField(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <span
                  className="text-foreground cursor-pointer hover:text-primary transition-colors truncate"
                  onClick={() => { setEditingField("company"); setFieldValue(contact.company || ""); }}
                >
                  {contact.company || "—"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {editingField === "phone" ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    className="h-6 text-xs"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => saveField("phone", fieldValue)}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingField(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <span
                  className="text-foreground cursor-pointer hover:text-primary transition-colors truncate"
                  onClick={() => { setEditingField("phone"); setFieldValue(contact.phone || ""); }}
                >
                  {contact.phone || "—"}
                </span>
              )}
            </div>

            {/* Salesperson */}
            {contact.salesperson && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground text-xs">Commercial :</span>
                <span className="text-foreground truncate text-xs">{contact.salesperson}</span>
              </div>
            )}
          </div>

          {/* Address */}
          {(contact.street || contact.city) && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-xs text-foreground">
                    {contact.street && <p>{contact.street}</p>}
                    {contact.street2 && <p>{contact.street2}</p>}
                    {(contact.zip || contact.city) && (
                      <p>{[contact.zip, contact.city].filter(Boolean).join(" ")}</p>
                    )}
                    {contact.country && <p className="text-muted-foreground">{contact.country}</p>}
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
              {!editingNotes && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setEditingNotes(true)}
                >
                  <Edit3 className="h-3 w-3" />
                </Button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-1">
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  className="min-h-[60px] text-xs resize-none"
                  autoFocus
                />
                <div className="flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setEditingNotes(false); setNotesValue(contact.notes || ""); }}>
                    Annuler
                  </Button>
                  <Button size="sm" className="h-6 text-xs" onClick={saveNotes}>
                    Sauver
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                {contact.notes || "Aucune note"}
              </p>
            )}
          </div>

          <Separator />

          {/* Past conversations */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Conversations ({pastConvos.length})
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => navigate(`/contacts/${contact.id}`)}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1">
              {pastConvos.map((conv) => (
                <button
                  key={conv.id}
                  className="w-full text-left p-2 rounded hover:bg-muted/50 transition-colors"
                  onClick={() => onSelectConversation?.(conv.id)}
                >
                  <p className="text-xs font-medium text-foreground truncate">{conv.subject}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={`text-[10px] px-1 py-0 ${statusColors[conv.status] || ""}`}>
                      {conv.status === "open" ? "Ouvert" : conv.status === "snoozed" ? "Pause" : "Fermé"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(conv.last_message_at), "d MMM", { locale: fr })}
                    </span>
                  </div>
                </button>
              ))}
              {pastConvos.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucune conversation</p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
