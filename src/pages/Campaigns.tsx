import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Megaphone, Send, Clock, AlertCircle, FileEdit, Trash2 } from "lucide-react";
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
  from_email: string | null;
  scheduled_at: string | null;
  created_at: string;
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  draft: { label: "Brouillon", variant: "secondary", icon: FileEdit },
  sending: { label: "En cours", variant: "default", icon: Clock },
  sent: { label: "Envoyée", variant: "outline", icon: Send },
  failed: { label: "Échouée", variant: "destructive", icon: AlertCircle },
};

export default function Campaigns() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setCampaigns(data);
      setLoading(false);
    };
    fetchCampaigns();
  }, []);

  const deleteCampaign = async (id: string) => {
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (!error) {
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Campagne supprimée" });
    }
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
                    if (campaign.status === "draft") {
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
                  <div className="text-right shrink-0">
                    <div className="text-sm tabular-nums font-medium">
                      {campaign.sent_count}/{campaign.total_recipients}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {format(new Date(campaign.created_at), "d MMM yyyy", { locale: fr })}
                    </div>
                  </div>
                  {campaign.status === "draft" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCampaign(campaign.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
