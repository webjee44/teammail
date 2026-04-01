import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate("/")}>
                Annuler
              </Button>
              <Button
                onClick={handleSend}
                disabled={!to || !subject || !body || !fromEmail || sending}
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
