import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { CampaignData } from "@/pages/CampaignWizard";

type Props = {
  data: CampaignData;
  onChange: (data: CampaignData) => void;
};

const variables = [
  { label: "{{nom}}", desc: "Nom du contact" },
  { label: "{{email}}", desc: "Email du contact" },
  { label: "{{entreprise}}", desc: "Entreprise" },
  { label: "{{téléphone}}", desc: "Téléphone" },
];

export function CampaignStepCompose({ data, onChange }: Props) {
  const [polishing, setPolishing] = useState(false);

  const insertVariable = (variable: string) => {
    onChange({ ...data, body_html: data.body_html + variable });
  };

  const polishWithAI = async () => {
    if (!data.body_html.trim()) return;
    setPolishing(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("polish-reply", {
        body: { text: data.body_html, instruction: "Améliore ce texte d'email professionnel. Garde les variables entre {{ }} intactes. Réponds uniquement avec le texte amélioré." },
      });
      if (error) throw error;
      if (result?.polished) {
        onChange({ ...data, body_html: result.polished });
        toast({ title: "Texte amélioré par l'IA" });
      }
    } catch (e: any) {
      toast({ title: "Erreur IA", description: e.message, variant: "destructive" });
    }
    setPolishing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Variables :</span>
        {variables.map((v) => (
          <Badge
            key={v.label}
            variant="outline"
            className="cursor-pointer hover:bg-primary/10 text-xs"
            onClick={() => insertVariable(v.label)}
          >
            {v.label}
          </Badge>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Contenu de l'email</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={polishWithAI}
            disabled={polishing || !data.body_html.trim()}
            className="gap-1.5 text-xs h-7"
          >
            <Sparkles className="h-3 w-3" />
            {polishing ? "Amélioration…" : "Améliorer avec l'IA"}
          </Button>
        </div>
        <Textarea
          value={data.body_html}
          onChange={(e) => onChange({ ...data, body_html: e.target.value })}
          placeholder={`Bonjour {{nom}},\n\nNous avons le plaisir de vous informer...\n\nCordialement,\nL'équipe`}
          className="min-h-[300px] font-mono text-sm"
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Les variables seront remplacées par les données de chaque contact lors de l'envoi.
      </p>
    </div>
  );
}
