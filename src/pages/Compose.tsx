import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Send, X, Loader2, Clock, CalendarIcon, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AttachmentUpload, FileToUpload } from "@/components/inbox/Attachments";

const Compose = () => {
  const navigate = useNavigate();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [mailboxes, setMailboxes] = useState<{ id: string; email: string; label: string | null }[]>([]);
  const [sending, setSending] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileToUpload[]>([]);
  const [signatureHtml, setSignatureHtml] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduling, setScheduling] = useState(false);

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
              <Label htmlFor="to">À</Label>
              <Input
                id="to"
                placeholder="destinataire@example.com"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
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
