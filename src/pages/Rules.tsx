import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Zap, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

type Condition = { field: string; operator: string; value: string };
type Action = { type: string; value: string };

type Rule = {
  id: string;
  name: string;
  is_active: boolean;
  conditions: Condition[];
  actions: Action[];
};

function parseJsonArray<T>(json: Json | null): T[] {
  if (!json || !Array.isArray(json)) return [];
  return json as unknown as T[];
}

const Rules = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [ruleName, setRuleName] = useState("");
  const [condField, setCondField] = useState("subject");
  const [condOp, setCondOp] = useState("contains");
  const [condValue, setCondValue] = useState("");
  const [actionType, setActionType] = useState("assign");
  const [actionValue, setActionValue] = useState("");

  const fetchRules = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rules")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erreur lors du chargement des règles");
    } else {
      setRules(
        (data || []).map((r) => ({
          id: r.id,
          name: r.name,
          is_active: r.is_active,
          conditions: parseJsonArray<Condition>(r.conditions),
          actions: parseJsonArray<Action>(r.actions),
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const resetForm = () => {
    setRuleName("");
    setCondField("subject");
    setCondOp("contains");
    setCondValue("");
    setActionType("assign");
    setActionValue("");
  };

  const handleCreate = async () => {
    if (!ruleName.trim() || !condValue.trim() || !actionValue.trim() || !user) return;
    setSaving(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("user_id", user.id)
        .single();
      if (!profile?.team_id) {
        toast.error("Aucune équipe trouvée");
        return;
      }

      const conditions: Condition[] = [{ field: condField, operator: condOp, value: condValue.trim() }];
      const actions: Action[] = [{ type: actionType, value: actionValue.trim() }];

      const { error } = await supabase.from("rules").insert({
        team_id: profile.team_id,
        name: ruleName.trim(),
        conditions: conditions as unknown as Json,
        actions: actions as unknown as Json,
      });

      if (error) throw error;
      toast.success("Règle créée");
      setDialogOpen(false);
      resetForm();
      fetchRules();
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, checked: boolean) => {
    const { error } = await supabase
      .from("rules")
      .update({ is_active: checked })
      .eq("id", id);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_active: checked } : r))
    );
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("rules").delete().eq("id", id);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    setRules((prev) => prev.filter((r) => r.id !== id));
    toast.success("Règle supprimée");
  };

  const fieldLabels: Record<string, string> = {
    from_email: "Expéditeur",
    subject: "Objet",
    body: "Contenu",
  };
  const opLabels: Record<string, string> = {
    contains: "contient",
    equals: "est",
    starts_with: "commence par",
  };
  const actionLabels: Record<string, string> = {
    assign: "Assigner à",
    tag: "Ajouter tag",
    status: "Changer statut",
  };

  return (
    <AppLayout>
      <div className="flex-1 p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Règles d'automatisation</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Automatisez le tri et l'assignation de vos conversations
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Nouvelle règle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une règle</DialogTitle>
                <DialogDescription>
                  Définissez les conditions et actions pour automatiser votre workflow
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nom de la règle</Label>
                  <Input
                    placeholder="Ex: Assigner les emails de support"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <div className="flex gap-2">
                    <Select value={condField} onValueChange={setCondField}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="from_email">Expéditeur</SelectItem>
                        <SelectItem value="subject">Objet</SelectItem>
                        <SelectItem value="body">Contenu</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={condOp} onValueChange={setCondOp}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">contient</SelectItem>
                        <SelectItem value="equals">est</SelectItem>
                        <SelectItem value="starts_with">commence par</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Valeur..."
                      className="flex-1"
                      value={condValue}
                      onChange={(e) => setCondValue(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Action</Label>
                  <div className="flex gap-2">
                    <Select value={actionType} onValueChange={setActionType}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assign">Assigner à</SelectItem>
                        <SelectItem value="tag">Ajouter tag</SelectItem>
                        <SelectItem value="status">Changer statut</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Valeur..."
                      className="flex-1"
                      value={actionValue}
                      onChange={(e) => setActionValue(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={!ruleName.trim() || !condValue.trim() || !actionValue.trim() || saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Créer la règle
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto opacity-30 mb-2" />
            <p className="text-sm">Aucune règle créée</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Zap
                        className={`h-5 w-5 ${rule.is_active ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <div>
                        <p className="font-medium text-sm">{rule.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {rule.conditions.map((c, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {fieldLabels[c.field] || c.field} {opLabels[c.operator] || c.operator} "{c.value}"
                            </Badge>
                          ))}
                          <span className="text-xs text-muted-foreground">→</span>
                          {rule.actions.map((a, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {actionLabels[a.type] || a.type}: {a.value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={(checked) => handleToggle(rule.id, checked)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => handleDelete(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Rules;