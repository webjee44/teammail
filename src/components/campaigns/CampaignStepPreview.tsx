import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Users, Mail, Eye } from "lucide-react";
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
  const recipient = data.recipients[parseInt(previewIdx)] || data.recipients[0];

  if (!recipient) {
    return <div className="text-center text-muted-foreground py-10">Aucun destinataire sélectionné</div>;
  }

  const previewSubject = replaceVariables(data.subject, recipient);
  const previewBody = replaceVariables(data.body_html, recipient);

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

      {/* Preview selector */}
      <div className="flex items-center gap-3">
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
            className="prose prose-sm max-w-none text-sm [&>p+p]:mt-4"
            dangerouslySetInnerHTML={{ __html: previewBody }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
