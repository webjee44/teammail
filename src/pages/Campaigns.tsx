import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, Megaphone, Send, Clock, AlertCircle, FileEdit,
  Trash2, Eye, MousePointerClick, MoreHorizontal, Pencil,
  Pause, Play, Copy,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  open_count: number;
  click_count: number;
  from_email: string | null;
  scheduled_at: string | null;
  created_at: string;
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  draft: { label: "Brouillon", variant: "secondary", icon: FileEdit },
  sending: { label: "En cours", variant: "default", icon: Clock },
  sent: { label: "Envoyée", variant: "outline", icon: Send },
  paused: { label: "En pause", variant: "secondary", icon: Pause },
  failed: { label: "Échouée", variant: "destructive", icon: AlertCircle },
};

function TrackingStats({ campaign }: { campaign: Campaign }) {
  if (campaign.status === "draft" || campaign.sent_count === 0) return null;
  const openRate = Math.round((campaign.open_count / campaign.sent_count) * 100);
  const clickRate = Math.round((campaign.click_count / campaign.sent_count) * 100);
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1 text-muted-foreground" title="Taux d'ouverture">
        <Eye className="h-3.5 w-3.5" />
        <span className="tabular-nums font-medium">{openRate}%</span>
        <span className="text-muted-foreground/60">({campaign.open_count})</span>
      </div>
      <div className="flex items-center gap-1 text-muted-foreground" title="Taux de clic">
        <MousePointerClick className="h-3.5 w-3.5" />
        <span className="tabular-nums font-medium">{clickRate}%</span>
        <span className="text-muted-foreground/60">({campaign.click_count})</span>
      </div>
    </div>
  );
}

export default function Campaigns() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);

  const fetchCampaigns = async () => {
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setCampaigns(data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const deleteCampaign = async (id: string) => {
    // Delete recipients first, then campaign
    await supabase.from("campaign_recipients").delete().eq("campaign_id", id);
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (!error) {
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Campagne supprimée" });
    } else {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
    setDeleteTarget(null);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("campaigns").update({ status }).eq("id", id);
    if (!error) {
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
      const labels: Record<string, string> = {
        paused: "Campagne mise en pause",
        draft: "Campagne repassée en brouillon",
        sending: "Campagne relancée",
      };
      toast({ title: labels[status] || "Statut mis à jour" });
    } else {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const duplicateCampaign = async (campaign: Campaign) => {
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.team_id) return;

    const { data: newCampaign, error } = await supabase
      .from("campaigns")
      .insert({
        team_id: profile.team_id,
        name: `${campaign.name} (copie)`,
        subject: campaign.subject,
        from_email: campaign.from_email,
        body_html: "",
        total_recipients: 0,
        created_by: user.id,
        status: "draft",
      })
      .select()
      .single();

    if (error || !newCampaign) {
      toast({ title: "Erreur", description: error?.message, variant: "destructive" });
      return;
    }

    // Copy recipients
    const { data: recipients } = await supabase
      .from("campaign_recipients")
      .select("email, name, company, contact_id")
      .eq("campaign_id", campaign.id);

    if (recipients && recipients.length > 0) {
      await supabase.from("campaign_recipients").insert(
        recipients.map((r) => ({
          campaign_id: newCampaign.id,
          email: r.email,
          name: r.name,
          company: r.company,
          contact_id: r.contact_id,
        }))
      );
      await supabase.from("campaigns").update({ total_recipients: recipients.length }).eq("id", newCampaign.id);
    }

    toast({ title: "Campagne dupliquée" });
    navigate(`/campaigns/new?id=${newCampaign.id}`);
  };

  return (
    <AppLayout>
      <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Campagnes</h1>
              <p className="text-sm text-muted-foreground">Envois groupés à vos contacts</p>
            </div>
          </div>
          <Button onClick={() => navigate("/campaigns/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle campagne
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20">
            <Megaphone className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">Aucune campagne</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Créez votre première campagne pour envoyer des emails groupés
            </p>
            <Button onClick={() => navigate("/campaigns/new")} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Créer une campagne
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const cfg = statusConfig[campaign.status] || statusConfig.draft;
              const Icon = cfg.icon;
              return (
                <div
                  key={campaign.id}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => {
                    if (campaign.status === "draft" || campaign.status === "paused") {
                      navigate(`/campaigns/new?id=${campaign.id}`);
                    }
                  }}
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm truncate">{campaign.name}</span>
                      <Badge variant={cfg.variant} className="text-[10px] h-5">
                        {cfg.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {campaign.subject || "(sans objet)"} · {campaign.from_email || "—"}
                    </p>
                  </div>
                  <TrackingStats campaign={campaign} />
                  <div className="text-right shrink-0">
                    <div className="text-sm tabular-nums font-medium">
                      {campaign.sent_count}/{campaign.total_recipients}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {format(new Date(campaign.created_at), "d MMM yyyy", { locale: fr })}
                    </div>
                  </div>

                  {/* Actions dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      {/* Edit — draft or paused only */}
                      {(campaign.status === "draft" || campaign.status === "paused") && (
                        <DropdownMenuItem onClick={() => navigate(`/campaigns/new?id=${campaign.id}`)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                      )}

                      {/* Duplicate — always available */}
                      <DropdownMenuItem onClick={() => duplicateCampaign(campaign)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Dupliquer
                      </DropdownMenuItem>

                      {/* Pause — only when sending */}
                      {campaign.status === "sending" && (
                        <DropdownMenuItem onClick={() => updateStatus(campaign.id, "paused")}>
                          <Pause className="h-4 w-4 mr-2" />
                          Mettre en pause
                        </DropdownMenuItem>
                      )}

                      {/* Resume — only when paused */}
                      {campaign.status === "paused" && (
                        <DropdownMenuItem onClick={() => updateStatus(campaign.id, "draft")}>
                          <Play className="h-4 w-4 mr-2" />
                          Reprendre (brouillon)
                        </DropdownMenuItem>
                      )}

                      {/* Back to draft — sent or failed */}
                      {(campaign.status === "sent" || campaign.status === "failed") && (
                        <DropdownMenuItem onClick={() => updateStatus(campaign.id, "draft")}>
                          <FileEdit className="h-4 w-4 mr-2" />
                          Repasser en brouillon
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator />

                      {/* Delete — always available */}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteTarget(campaign)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer la campagne ?</AlertDialogTitle>
              <AlertDialogDescription>
                La campagne <strong>« {deleteTarget?.name} »</strong> et tous ses destinataires
                seront définitivement supprimés. Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteTarget && deleteCampaign(deleteTarget.id)}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
