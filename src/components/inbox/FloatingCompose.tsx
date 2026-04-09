import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/inbox/conversation/RichTextEditor";
import { RecipientFields } from "@/components/inbox/conversation/RecipientFields";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Send, X, Loader2, Clock, CalendarIcon, FileText, Wand2, Minus, Maximize2, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AttachmentUpload, FileToUpload } from "@/components/inbox/Attachments";
import { TemplatePickerDialog } from "@/components/inbox/TemplatePickerDialog";
import { useDraft } from "@/hooks/useDraft";
import { useComposeWindow } from "@/hooks/useComposeWindow";


export function FloatingCompose() {
  const { state, closeCompose, toggleMinimize } = useComposeWindow();
  const navigate = useNavigate();
  const { draft, updateDraft, deleteDraft, loading: draftLoading, resetDraft } = useDraft({ draftId: state.draftId });

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [draftInitialized, setDraftInitialized] = useState(false);
  const [mailboxes, setMailboxes] = useState<{ id: string; email: string; label: string | null }[]>([]);
  const [sending, setSending] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileToUpload[]>([]);
  const [signatureHtml, setSignatureHtml] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduling, setScheduling] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [polishing, setPolishing] = useState(false);
  const [generatingSubject, setGeneratingSubject] = useState(false);

  // Reset state when compose window opens
  useEffect(() => {
    if (!state.isOpen) return;
    setTo(state.initialTo || "");
    setSubject(state.initialSubject || "");
    setBody(state.initialBody || "");
    setDraftInitialized(false);
    setAttachedFiles([]);
    setCc([]);
    setBcc([]);
    setSending(false);
    setScheduling(false);
    // Reset draft hook so it doesn't carry over from previous compose
    resetDraft(state.draftId || null);
  }, [state.isOpen, state.initialTo, state.initialSubject, state.initialBody, state.draftId, resetDraft]);

  const handlePolish = async () => {
    if (!body.trim() && body !== "<p></p>") return;
    setPolishing(true);
    try {
      const { data, error } = await supabase.functions.invoke("polish-reply", {
        body: { text: body, format: "html" },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      if (data?.polished) {
        setBody(data.polished);
        toast.success("Texte peaufiné");
      }
    } catch {
      toast.error("Erreur lors du peaufinage");
    } finally {
      setPolishing(false);
    }
  };

  useEffect(() => {
    if (!state.isOpen) return;
    const fetchMailboxes = async () => {
      const { data } = await supabase
        .from("team_mailboxes")
        .select("id, email, label")
        .eq("sync_enabled", true)
        .order("created_at");
      if (data && data.length > 0) {
        setMailboxes(data);
        if (!fromEmail) setFromEmail(data[0].email);
      }
    };
    fetchMailboxes();
  }, [state.isOpen]);

  useEffect(() => {
    if (!fromEmail || mailboxes.length === 0) {
      setSignatureHtml("");
      return;
    }
    const mb = mailboxes.find((m) => m.email === fromEmail);
    if (!mb) return;

    const loadSignature = async () => {
      const { data: ms } = await supabase
        .from("mailbox_signatures")
        .select("signature_id")
        .eq("mailbox_id", mb.id)
        .maybeSingle();

      if (ms?.signature_id) {
        const { data: sig } = await supabase
          .from("signatures")
          .select("body_html")
          .eq("id", ms.signature_id)
          .maybeSingle();
        setSignatureHtml(sig?.body_html || "");
        return;
      }

      const { data: defaultSig } = await supabase
        .from("signatures")
        .select("body_html")
        .eq("is_default", true)
        .maybeSingle();
      setSignatureHtml(defaultSig?.body_html || "");
    };
    loadSignature();
  }, [fromEmail, mailboxes]);

  // Restore draft
  useEffect(() => {
    if (draftLoading || draftInitialized || !state.isOpen) return;
    if (!state.draftId) {
      setDraftInitialized(true);
      return;
    }
    if (draft.to_email && !state.initialTo) setTo(draft.to_email);
    if (draft.subject && !state.initialSubject) setSubject(draft.subject);
    if (draft.body && !state.initialBody) setBody(draft.body);
    if (draft.from_email) setFromEmail(draft.from_email);
    setDraftInitialized(true);
  }, [draftLoading, draft, draftInitialized, state.isOpen, state.draftId, state.initialTo, state.initialSubject, state.initialBody]);

  // Auto-save draft
  useEffect(() => {
    if (!draftInitialized || !state.isOpen) return;
    updateDraft({ to_email: to, from_email: fromEmail, subject, body });
  }, [to, fromEmail, subject, body, draftInitialized, updateDraft, state.isOpen]);

  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    };
  }, []);

  const handleSend = async () => {
    if (!to || !subject || !body || !fromEmail) return;
    setSending(true);

    // Capture values for deferred send
    const sendPayload = {
      to, subject, body, fromEmail,
      attachments: attachedFiles.map((f) => ({
        filename: f.name,
        mime_type: f.file.type || "application/octet-stream",
        data: f.base64,
      })),
    };

    // Delete draft immediately so it disappears from brouillons
    await deleteDraft();

    cancelledRef.current = false;
    closeCompose();

    const toastId = toast("Envoi dans 15 secondes…", {
      duration: 15500,
      action: {
        label: "Annuler",
        onClick: () => {
          cancelledRef.current = true;
          if (sendTimerRef.current) {
            clearTimeout(sendTimerRef.current);
            sendTimerRef.current = null;
          }
          toast.dismiss(toastId);
          toast.info("Envoi annulé");
          setSending(false);
        },
      },
    });

    sendTimerRef.current = setTimeout(async () => {
      if (cancelledRef.current) return;
      toast.dismiss(toastId);
      try {
        const { data, error } = await supabase.functions.invoke("gmail-send", {
          body: {
            to: sendPayload.to,
            subject: sendPayload.subject,
            body: sendPayload.body,
            from_email: sendPayload.fromEmail,
            attachments: sendPayload.attachments.length > 0 ? sendPayload.attachments : undefined,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success("Email envoyé !");
      } catch (err: any) {
        toast.error("Erreur : " + (err.message || String(err)));
      } finally {
        setSending(false);
      }
    }, 15000);
  };

  const handleSchedule = async () => {
    if (!to || !subject || !body || !fromEmail || !scheduleDate) return;
    const [hours, minutes] = scheduleTime.split(":").map(Number);
    const scheduledAt = new Date(scheduleDate);
    scheduledAt.setHours(hours, minutes, 0, 0);
    if (scheduledAt <= new Date()) {
      toast.error("La date doit être dans le futur");
      return;
    }
    setScheduling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile?.team_id) throw new Error("Aucune équipe trouvée");
      const { error } = await supabase.from("scheduled_emails").insert({
        team_id: profile.team_id,
        created_by: user.id,
        to_email: to,
        subject,
        body,
        from_email: fromEmail,
        scheduled_at: scheduledAt.toISOString(),
      });
      if (error) throw error;
      await deleteDraft();
      toast.success(`Email programmé pour le ${format(scheduledAt, "d MMMM à HH:mm", { locale: fr })}`);
      closeCompose();
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || String(err)));
    } finally {
      setScheduling(false);
      setScheduleOpen(false);
    }
  };

  if (!state.isOpen) return null;

  const isFormValid = to && subject && body && fromEmail;

  // Minimized bar
  if (state.isMinimized) {
    return (
      <div className="fixed bottom-0 right-6 z-50 w-72 rounded-t-lg border border-border bg-background shadow-lg">
        <button
          onClick={toggleMinimize}
          className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 rounded-t-lg"
        >
          <span className="truncate">{subject || "Nouveau message"}</span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            <Maximize2 className="h-3.5 w-3.5" />
            <X className="h-3.5 w-3.5 hover:text-destructive" onClick={(e) => { e.stopPropagation(); closeCompose(); }} />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 right-6 z-50 w-[640px] max-h-[80vh] flex flex-col rounded-t-lg border border-border bg-background shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 rounded-t-lg border-b border-border shrink-0">
        <span className="text-sm font-medium truncate">{subject || "Nouveau message"}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleMinimize}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={closeCompose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* From */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-8 shrink-0">De</Label>
          <Select value={fromEmail} onValueChange={setFromEmail}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Boîte mail" />
            </SelectTrigger>
            <SelectContent>
              {mailboxes.map((mb) => (
                <SelectItem key={mb.id} value={mb.email} className="text-xs">
                  {mb.email}{mb.label ? ` (${mb.label})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Recipients */}
        <RecipientFields
          to={to}
          cc={cc}
          bcc={bcc}
          onToChange={setTo}
          onCcChange={setCc}
          onBccChange={setBcc}
        />
        {/* Subject */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-8 shrink-0">Objet</Label>
          <div className="flex-1 relative flex items-center">
            <Input
              placeholder="Objet du message"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-8 text-xs pr-16"
            />
            <div className="absolute right-1 flex items-center gap-0.5">
              <Button
                type="button" variant="ghost" size="icon"
                className="h-6 w-6"
                title="Générer un objet avec l'IA"
                disabled={generatingSubject || !body.trim()}
                onClick={async () => {
                  setGeneratingSubject(true);
                  try {
                    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
                    const { data: { session } } = await supabase.auth.getSession();
                    const res = await fetch(`${SUPABASE_URL}/functions/v1/polish-reply`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session?.access_token}`,
                        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                      },
                      body: JSON.stringify({
                        text: `Génère un objet d'email court et professionnel (max 10 mots) pour ce contenu. Retourne UNIQUEMENT l'objet, sans guillemets :\n\n${body.replace(/<[^>]*>/g, '').slice(0, 500)}`,
                        format: "text",
                      }),
                    });
                    const data = await res.json();
                    if (data?.polished) setSubject(data.polished.replace(/^["«]|["»]$/g, ''));
                  } catch {
                    toast.error("Erreur lors de la génération");
                  } finally {
                    setGeneratingSubject(false);
                  }
                }}
              >
                {generatingSubject ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-muted-foreground" />}
              </Button>
              {subject && (
                <Button
                  type="button" variant="ghost" size="icon"
                  className="h-6 w-6"
                  title="Effacer l'objet"
                  onClick={() => setSubject("")}
                >
                  <XCircle className="h-3 w-3 text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <RichTextEditor
          value={body}
          onChange={setBody}
          placeholder="Tapez votre message..."
          onTemplateClick={() => setTemplateOpen(true)}
        />

        {/* Signature */}
        {signatureHtml && (
          <div
            className="p-2 rounded-md border border-border bg-muted/30 text-xs"
            dangerouslySetInnerHTML={{ __html: signatureHtml }}
          />
        )}

        {/* Attachments */}
        <AttachmentUpload files={attachedFiles} onFilesChange={setAttachedFiles} />
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-1.5 px-3 py-2 border-t border-border shrink-0">
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setTemplateOpen(true)} className="h-7 px-2 gap-1 text-xs">
            <FileText className="h-3 w-3" />
            Template
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!subject.trim() && !body.trim()}
            onClick={async () => {
              const name = window.prompt("Nom du template :", subject || "");
              if (!name) return;
              try {
                const { data: { user: u } } = await supabase.auth.getUser();
                if (!u) throw new Error("Non authentifié");
                const { data: profile } = await supabase.from("profiles").select("team_id").eq("user_id", u.id).maybeSingle();
                if (!profile?.team_id) throw new Error("Aucune équipe");
                const { error } = await supabase.from("email_templates").insert({
                  team_id: profile.team_id,
                  created_by: u.id,
                  name,
                  subject: subject,
                  body: body.replace(/<[^>]*>/g, ''),
                });
                if (error) throw error;
                toast.success("Template créé !");
              } catch (err: any) {
                toast.error("Erreur : " + (err.message || String(err)));
              }
            }}
            className="h-7 px-2 gap-1 text-xs"
          >
            <FileText className="h-3 w-3" />
            Sauver comme template
          </Button>
          <Button size="sm" variant="ghost" onClick={handlePolish} disabled={polishing || !body.trim()} className="h-7 px-2 gap-1 text-xs">
            {polishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            Peaufiner
          </Button>
          <TemplatePickerDialog
            open={templateOpen}
            onOpenChange={setTemplateOpen}
            onInsert={(tplSubject, tplBody) => {
              if (tplSubject) setSubject(tplSubject);
              setBody(tplBody);
            }}
            recipientEmail={to}
          />
        </div>
        <div className="flex gap-1.5">
          <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" disabled={!isFormValid || scheduling} className="h-7 px-2 gap-1 text-xs">
                {scheduling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
                Plus tard
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
              <div className="space-y-4">
                {(() => {
                  const now = new Date();
                  const next = new Date(now);
                  next.setDate(next.getDate() + 1);
                  const day = next.getDay();
                  if (day === 0) next.setDate(next.getDate() + 1);
                  if (day === 6) next.setDate(next.getDate() + 2);
                  const dayName = format(next, "EEEE", { locale: fr });
                  return (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full gap-2 text-xs capitalize"
                      disabled={!isFormValid || scheduling}
                      onClick={async () => {
                        next.setHours(8, 45, 0, 0);
                        setScheduleDate(next);
                        setScheduleTime("08:45");
                        if (!to || !subject || !body || !fromEmail) return;
                        setScheduling(true);
                        try {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) throw new Error("Non authentifié");
                          const { data: profile } = await supabase
                            .from("profiles")
                            .select("team_id")
                            .eq("user_id", user.id)
                            .maybeSingle();
                          if (!profile?.team_id) throw new Error("Aucune équipe trouvée");
                          const { error } = await supabase.from("scheduled_emails").insert({
                            team_id: profile.team_id,
                            created_by: user.id,
                            to_email: to,
                            subject,
                            body,
                            from_email: fromEmail,
                            scheduled_at: next.toISOString(),
                          });
                          if (error) throw error;
                          toast.success(`Email programmé pour ${dayName} à 8h45`);
                          closeCompose();
                        } catch (err: any) {
                          toast.error("Erreur : " + (err.message || String(err)));
                        } finally {
                          setScheduling(false);
                          setScheduleOpen(false);
                        }
                      }}
                    >
                      {scheduling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
                      {dayName} 8h45
                    </Button>
                  );
                })()}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !scheduleDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduleDate ? format(scheduleDate, "d MMMM yyyy", { locale: fr }) : "Choisir une date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduleDate}
                        onSelect={setScheduleDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Heure</Label>
                  <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                </div>
                <Button onClick={handleSchedule} disabled={!scheduleDate || scheduling} className="w-full gap-2" size="sm">
                  {scheduling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
                  Programmer l'envoi
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button size="sm" onClick={handleSend} disabled={!isFormValid || sending} className="h-7 px-3 gap-1 text-xs">
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Envoyer
          </Button>
        </div>
      </div>
    </div>
  );
}
