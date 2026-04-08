import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check, Megaphone } from "lucide-react";
import { CampaignStepConfig } from "@/components/campaigns/CampaignStepConfig";
import { CampaignStepRecipients } from "@/components/campaigns/CampaignStepRecipients";
import { CampaignStepCompose } from "@/components/campaigns/CampaignStepCompose";
import { CampaignStepPreview } from "@/components/campaigns/CampaignStepPreview";
import { cn } from "@/lib/utils";

export type CampaignData = {
  id?: string;
  name: string;
  subject: string;
  from_email: string;
  body_html: string;
  recipients: Recipient[];
};

export type Recipient = {
  contact_id?: string;
  email: string;
  name: string;
  company: string;
};

const steps = [
  { label: "Configuration", description: "Nom, mailbox, objet" },
  { label: "Destinataires", description: "Sélection des contacts" },
  { label: "Rédaction", description: "Contenu de l'email" },
  { label: "Aperçu & Envoi", description: "Vérification finale" },
];

export default function CampaignWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [data, setData] = useState<CampaignData>({
    name: "",
    subject: "",
    from_email: "",
    body_html: "",
    recipients: [],
  });

  // Load existing campaign if editing
  useEffect(() => {
    const campaignId = searchParams.get("id");
    if (!campaignId) return;
    const load = async () => {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .maybeSingle();
      if (!campaign) return;

      const { data: recipients } = await supabase
        .from("campaign_recipients")
        .select("*")
        .eq("campaign_id", campaignId);

      setData({
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        from_email: campaign.from_email || "",
        body_html: campaign.body_html,
        recipients: (recipients || []).map((r) => ({
          contact_id: r.contact_id || undefined,
          email: r.email,
          name: r.name || "",
          company: r.company || "",
        })),
      });
    };
    load();
  }, [searchParams]);

  const saveDraft = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile?.team_id) throw new Error("No team");

      if (data.id) {
        await supabase.from("campaigns").update({
          name: data.name,
          subject: data.subject,
          from_email: data.from_email,
          body_html: data.body_html,
          total_recipients: data.recipients.length,
        }).eq("id", data.id);

        // Replace recipients
        await supabase.from("campaign_recipients").delete().eq("campaign_id", data.id);
        if (data.recipients.length > 0) {
          await supabase.from("campaign_recipients").insert(
            data.recipients.map((r) => ({
              campaign_id: data.id!,
              contact_id: r.contact_id || null,
              email: r.email,
              name: r.name,
              company: r.company,
            }))
          );
        }
      } else {
        const { data: campaign, error } = await supabase
          .from("campaigns")
          .insert({
            team_id: profile.team_id,
            name: data.name || "Sans nom",
            subject: data.subject,
            from_email: data.from_email,
            body_html: data.body_html,
            total_recipients: data.recipients.length,
            created_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;

        if (data.recipients.length > 0) {
          await supabase.from("campaign_recipients").insert(
            data.recipients.map((r) => ({
              campaign_id: campaign.id,
              contact_id: r.contact_id || null,
              email: r.email,
              name: r.name,
              company: r.company,
            }))
          );
        }
        setData((prev) => ({ ...prev, id: campaign.id }));
      }
      toast({ title: "Brouillon sauvegardé" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const sendCampaign = async () => {
    if (!data.id) {
      await saveDraft();
    }
    if (!data.id && !data.name) return;

    setSending(true);
    try {
      // Save draft first if needed
      if (!data.id) {
        await saveDraft();
      }

      const { data: result, error } = await supabase.functions.invoke("send-campaign", {
        body: { campaign_id: data.id },
      });

      if (error) throw error;
      toast({ title: "Campagne lancée !", description: `Envoi en cours à ${data.recipients.length} destinataires` });
      navigate("/campaigns");
    } catch (e: any) {
      toast({ title: "Erreur d'envoi", description: e.message, variant: "destructive" });
    }
    setSending(false);
  };

  const canNext = () => {
    switch (currentStep) {
      case 0: return data.name.trim() !== "" && data.from_email !== "";
      case 1: return data.recipients.length > 0;
      case 2: return data.body_html.trim() !== "";
      case 3: return true;
      default: return false;
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Megaphone className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Nouvelle campagne</h1>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving}>
              {saving ? "Sauvegarde…" : "Sauvegarder le brouillon"}
            </Button>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 mb-8">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center flex-1">
              <button
                onClick={() => i <= currentStep && setCurrentStep(i)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-all w-full",
                  i === currentStep
                    ? "bg-primary/10 text-primary"
                    : i < currentStep
                    ? "text-primary/60 hover:bg-primary/5 cursor-pointer"
                    : "text-muted-foreground/40"
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all",
                    i === currentStep
                      ? "bg-primary text-primary-foreground"
                      : i < currentStep
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {i < currentStep ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <div className="text-left min-w-0 hidden sm:block">
                  <div className="text-xs font-medium truncate">{step.label}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{step.description}</div>
                </div>
              </button>
              {i < steps.length - 1 && (
                <div className={cn("h-px flex-1 mx-1", i < currentStep ? "bg-primary/30" : "bg-border")} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 min-h-0">
          {currentStep === 0 && <CampaignStepConfig data={data} onChange={setData} />}
          {currentStep === 1 && <CampaignStepRecipients data={data} onChange={setData} />}
          {currentStep === 2 && <CampaignStepCompose data={data} onChange={setData} />}
          {currentStep === 3 && <CampaignStepPreview data={data} onSend={sendCampaign} sending={sending} />}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6 border-t mt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((s) => s - 1)}
            disabled={currentStep === 0}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Précédent
          </Button>
          {currentStep < 3 ? (
            <Button
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canNext()}
              className="gap-2"
            >
              Suivant
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={sendCampaign} disabled={sending || !canNext()} className="gap-2">
              {sending ? "Envoi en cours…" : "Lancer la campagne"}
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
