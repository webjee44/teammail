import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Users, Mail, Eye, FlaskConical, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { CampaignData } from "@/pages/CampaignWizard";

type Props = {
  data: CampaignData;
  onSend: () => void;
  sending: boolean;
};

function replaceVariables(text: string, recipient: { name: string; email: string; company: string }) {
  return text
    .replace(/\{\{nom\}\}/g, recipient.name || "—")
    .replace(/\{\{email\}\}/g, recipient.email || "—")
    .replace(/\{\{entreprise\}\}/g, recipient.company || "—")
    .replace(/\{\{téléphone\}\}/g, "—");
}

export function CampaignStepPreview({ data, onSend, sending }: Props) {
  const [previewIdx, setPreviewIdx] = useState("0");
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const recipient = data.recipients[parseInt(previewIdx)] || data.recipients[0];

  if (!recipient) {
    return <div className="text-center text-muted-foreground py-10">Aucun destinataire sélectionné</div>;
  }

  const previewSubject = replaceVariables(data.subject, recipient);
  const previewBody = replaceVariables(data.body_html, recipient);

  const sendTestEmail = async () => {
    if (!testEmail.trim()) return;
    setSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke("gmail-send", {
        body: {
          to: testEmail.trim(),
          subject: `[TEST] ${previewSubject}`,
          body: previewBody,
          from_email: data.from_email,
          skip_signature: true,
        },
      });
      if (error) throw error;
      toast({ title: "Email de test envoyé", description: `Envoyé à ${testEmail}` });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
    setSendingTest(false);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <div className="text-2xl font-bold">{data.recipients.length}</div>
              <div className="text-xs text-muted-foreground">Destinataires</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-medium truncate">{data.from_email}</div>
              <div className="text-xs text-muted-foreground">Expéditeur</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Send className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-medium">{data.name}</div>
              <div className="text-xs text-muted-foreground">Campagne</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview selector + Test mail */}
      <div className="flex items-center gap-3 flex-wrap">
        <Eye className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Aperçu pour :</span>
        <Select value={previewIdx} onValueChange={setPreviewIdx}>
          <SelectTrigger className="w-[250px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {data.recipients.map((r, i) => (
              <SelectItem key={i} value={String(i)}>
                {r.name || r.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Input
            type="email"
            placeholder="email@test.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="w-[200px] h-8 text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={sendTestEmail}
            disabled={sendingTest || !testEmail.trim()}
            className="gap-1.5 h-8"
          >
            {sendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
            Test mail
          </Button>
        </div>
      </div>

      {/* Email preview */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50 py-3 px-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">Aperçu</Badge>
            <CardTitle className="text-sm font-medium">{previewSubject}</CardTitle>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            De : {data.from_email} · À : {recipient.email}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div
            className="prose prose-sm max-w-none text-sm [&>p+p]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5 [&_li>p]:inline"
            dangerouslySetInnerHTML={{ __html: previewBody }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
