import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Send, X, Loader2, Clock, CalendarIcon, FileText, Wand2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AttachmentUpload, FileToUpload } from "@/components/inbox/Attachments";
import { TemplatePickerDialog } from "@/components/inbox/TemplatePickerDialog";
import { useDraft } from "@/hooks/useDraft";
import { Badge } from "@/components/ui/badge";

const Compose = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get("draft");
  const { draft, updateDraft, deleteDraft, loading: draftLoading } = useDraft({ draftId });

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
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");
  const [polishing, setPolishing] = useState(false);

  const handlePolish = async () => {
    if (!body.trim()) return;
    setPolishing(true);
    try {
      const { data, error } = await supabase.functions.invoke("polish-reply", {
        body: { text: body, format: "text" },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      if (data?.polished) {
        setBody(data.polished);
        toast.success("Texte peaufiné");
      }
    } catch (err: any) {
      toast.error("Erreur lors du peaufinage");
    } finally {
      setPolishing(false);
    }
  };

  const addCcEmail = (value?: string) => {
    const trimmed = (value || ccInput).trim().toLowerCase();
    if (trimmed && trimmed.includes("@") && !cc.includes(trimmed)) {
      setCc([...cc, trimmed]);
    }
    setCcInput("");
  };

  const addBccEmail = (value?: string) => {
    const trimmed = (value || bccInput).trim().toLowerCase();
    if (trimmed && trimmed.includes("@") && !bcc.includes(trimmed)) {
      setBcc([...bcc, trimmed]);
    }
    setBccInput("");
  };

  useEffect(() => {
    const fetchMailboxes = async () => {
      const { data } = await supabase
        .from("team_mailboxes")
        .select("id, email, label")
        .eq("sync_enabled", true)
        .order("created_at");
      if (data && data.length > 0) {
        setMailboxes(data);
        setFromEmail(data[0].email);
      }
    };
    fetchMailboxes();
  }, []);

  // Load signature when mailbox changes
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

  // Restore draft fields on load, then URL params override
  useEffect(() => {
    if (draftLoading || draftInitialized) return;
    if (draft.to_email) setTo(draft.to_email);
    if (draft.subject) setSubject(draft.subject);
    if (draft.body) setBody(draft.body);
    if (draft.from_email) setFromEmail(draft.from_email);
    // URL params override draft values
    const urlTo = searchParams.get("to");
    const urlSubject = searchParams.get("subject");
    const urlBody = searchParams.get("body");
    if (urlTo) setTo(urlTo);
    if (urlSubject) setSubject(urlSubject);
    if (urlBody) setBody(urlBody);
    setDraftInitialized(true);
  }, [draftLoading, draft, draftInitialized, searchParams]);

  // Auto-save draft on field changes
  useEffect(() => {
    if (!draftInitialized) return;
    updateDraft({ to_email: to, from_email: fromEmail, subject, body });
  }, [to, fromEmail, subject, body, draftInitialized, updateDraft]);

  const handleSend = async () => {
    if (!to || !subject || !body || !fromEmail) return;
    setSending(true);
    try {
      const gmailAttachments = attachedFiles.map((f) => ({
        filename: f.name,
        mime_type: f.file.type || "application/octet-stream",
        data: f.base64,
      }));
      const { data, error } = await supabase.functions.invoke("gmail-send", {
        body: { to, subject, body, from_email: fromEmail, attachments: gmailAttachments.length > 0 ? gmailAttachments : undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await deleteDraft();
      toast.success("Email envoyé !");
      navigate("/");
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || String(err)));
    } finally {
      setSending(false);
    }
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

      const gmailAttachments = attachedFiles.length > 0
        ? attachedFiles.map((f) => ({
            filename: f.name,
            mime_type: f.file.type || "application/octet-stream",
            data: f.base64,
          }))
        : null;

      const { error } = await supabase.from("scheduled_emails").insert({
        team_id: profile.team_id,
        created_by: user.id,
        to_email: to,
        subject,
        body,
        from_email: fromEmail,
        attachments: gmailAttachments,
        scheduled_at: scheduledAt.toISOString(),
      });

      if (error) throw error;

      await deleteDraft();
      toast.success(`Email programmé pour le ${format(scheduledAt, "d MMMM à HH:mm", { locale: fr })}`);
      navigate("/");
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || String(err)));
    } finally {
      setScheduling(false);
      setScheduleOpen(false);
    }
  };

  const isFormValid = to && subject && body && fromEmail;

  return (
    <AppLayout>
      <div className="flex-1 p-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Nouveau message</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="from">De</Label>
              <Select value={fromEmail} onValueChange={setFromEmail}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une boîte mail" />
                </SelectTrigger>
                <SelectContent>
                  {mailboxes.map((mb) => (
                    <SelectItem key={mb.id} value={mb.email}>
                      {mb.email}{mb.label ? ` (${mb.label})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="to">À</Label>
                <div className="flex gap-1">
                  {!showCc && (
                    <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5 text-muted-foreground" onClick={() => setShowCc(true)}>
                      Cc
                    </Button>
                  )}
                  {!showBcc && (
                    <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5 text-muted-foreground" onClick={() => setShowBcc(true)}>
                      Cci
                    </Button>
                  )}
                </div>
              </div>
              <Input
                id="to"
                placeholder="destinataire@example.com"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            {showCc && (
              <div className="space-y-2">
                <Label>Cc</Label>
                <div className="flex flex-wrap items-center gap-1 p-2 border rounded-md min-h-[36px]">
                  {cc.map((email) => (
                    <Badge key={email} variant="secondary" className="text-xs gap-1 py-0 h-5">
                      {email}
                      <button onClick={() => setCc(cc.filter((e) => e !== email))} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <Input
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addCcEmail(); } }}
                    onBlur={() => addCcEmail()}
                    placeholder="email@exemple.com"
                    className="border-0 shadow-none h-6 text-xs px-1 focus-visible:ring-0 min-w-[140px] flex-1"
                  />
                </div>
              </div>
            )}
            {showBcc && (
              <div className="space-y-2">
                <Label>Cci</Label>
                <div className="flex flex-wrap items-center gap-1 p-2 border rounded-md min-h-[36px]">
                  {bcc.map((email) => (
                    <Badge key={email} variant="secondary" className="text-xs gap-1 py-0 h-5">
                      {email}
                      <button onClick={() => setBcc(bcc.filter((e) => e !== email))} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <Input
                    value={bccInput}
                    onChange={(e) => setBccInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addBccEmail(); } }}
                    onBlur={() => addBccEmail()}
                    placeholder="email@exemple.com"
                    className="border-0 shadow-none h-6 text-xs px-1 focus-visible:ring-0 min-w-[140px] flex-1"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="subject">Objet</Label>
              <Input
                id="subject"
                placeholder="Objet du message"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                placeholder="Tapez votre message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[250px] resize-none"
              />
            </div>
            {signatureHtml && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Signature</Label>
                <div
                  className="p-3 rounded-md border border-border bg-muted/30 text-sm"
                  dangerouslySetInnerHTML={{ __html: signatureHtml }}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Pièces jointes</Label>
              <AttachmentUpload files={attachedFiles} onFilesChange={setAttachedFiles} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate("/")}>
                Annuler
              </Button>

              <Button
                variant="outline"
                onClick={() => setTemplateOpen(true)}
                disabled={false}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                Template
              </Button>

              <Button
                variant="outline"
                onClick={handlePolish}
                disabled={polishing || !body.trim()}
                className="gap-2"
              >
                {polishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
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

              <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={!isFormValid || scheduling}
                    className="gap-2"
                  >
                    {scheduling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                    Envoyer plus tard
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
                          disabled={!to || !subject || !body || !fromEmail || scheduling}
                          onClick={async () => {
                            next.setHours(8, 45, 0, 0);
                            setScheduleDate(next);
                            setScheduleTime("08:45");
                            // Programme directement
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
                              navigate("/");
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
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !scheduleDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {scheduleDate
                              ? format(scheduleDate, "d MMMM yyyy", { locale: fr })
                              : "Choisir une date"}
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
                      <Input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleSchedule}
                      disabled={!scheduleDate || scheduling}
                      className="w-full gap-2"
                    >
                      {scheduling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                      Programmer l'envoi
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                onClick={handleSend}
                disabled={!isFormValid || sending}
                className="gap-2"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Envoyer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Compose;
