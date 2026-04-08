import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { CampaignData } from "@/pages/CampaignWizard";

type Props = {
  data: CampaignData;
  onChange: (data: CampaignData) => void;
};

export function CampaignStepConfig({ data, onChange }: Props) {
  const [mailboxes, setMailboxes] = useState<{ id: string; email: string; label: string | null }[]>([]);

  useEffect(() => {
    supabase.from("team_mailboxes").select("id, email, label").eq("sync_enabled", true).then(({ data }) => {
      if (data) setMailboxes(data);
    });
  }, []);

  return (
    <div className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <Label htmlFor="name">Nom de la campagne</Label>
        <Input
          id="name"
          placeholder="Ex : Newsletter Avril 2026"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Expéditeur</Label>
        <Select value={data.from_email} onValueChange={(v) => onChange({ ...data, from_email: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Choisir une mailbox" />
          </SelectTrigger>
          <SelectContent>
            {mailboxes.map((mb) => (
              <SelectItem key={mb.id} value={mb.email}>
                {mb.label || mb.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Objet de l'email</Label>
        <Input
          id="subject"
          placeholder="Ex : Découvrez nos nouveautés {{nom}}"
          value={data.subject}
          onChange={(e) => onChange({ ...data, subject: e.target.value })}
        />
        <p className="text-[11px] text-muted-foreground">
          Variables disponibles : {"{{nom}}"}, {"{{email}}"}, {"{{entreprise}}"}, {"{{téléphone}}"}
        </p>
      </div>
    </div>
  );
}
