import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Zap, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Rule = {
  id: string;
  name: string;
  is_active: boolean;
  conditions: { field: string; operator: string; value: string }[];
  actions: { type: string; value: string }[];
};

const mockRules: Rule[] = [
  {
    id: "1",
    name: "Assigner les emails de facturation à Sarah",
    is_active: true,
    conditions: [{ field: "from_email", operator: "contains", value: "billing" }],
    actions: [{ type: "assign", value: "Sarah" }],
  },
  {
    id: "2",
    name: "Taguer les emails urgents",
    is_active: true,
    conditions: [{ field: "subject", operator: "contains", value: "urgent" }],
    actions: [{ type: "tag", value: "Urgent" }],
  },
  {
    id: "3",
    name: "Auto-close newsletters",
    is_active: false,
    conditions: [{ field: "from_email", operator: "contains", value: "newsletter" }],
    actions: [{ type: "status", value: "closed" }],
  },
];

const Rules = () => {
  const [rules, setRules] = useState(mockRules);

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
          <Dialog>
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
                  <Input placeholder="Ex: Assigner les emails de support" />
                </div>
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <div className="flex gap-2">
                    <Select defaultValue="subject">
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="from_email">Expéditeur</SelectItem>
                        <SelectItem value="subject">Objet</SelectItem>
                        <SelectItem value="body">Contenu</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select defaultValue="contains">
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">contient</SelectItem>
                        <SelectItem value="equals">est</SelectItem>
                        <SelectItem value="starts_with">commence par</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Valeur..." className="flex-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Action</Label>
                  <div className="flex gap-2">
                    <Select defaultValue="assign">
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assign">Assigner à</SelectItem>
                        <SelectItem value="tag">Ajouter tag</SelectItem>
                        <SelectItem value="status">Changer statut</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Valeur..." className="flex-1" />
                  </div>
                </div>
                <Button className="w-full">Créer la règle</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

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
                      <div className="flex items-center gap-2 mt-1">
                        {rule.conditions.map((c, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {c.field} {c.operator} "{c.value}"
                          </Badge>
                        ))}
                        <span className="text-xs text-muted-foreground">→</span>
                        {rule.actions.map((a, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {a.type}: {a.value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) => {
                        setRules((prev) =>
                          prev.map((r) =>
                            r.id === rule.id ? { ...r, is_active: checked } : r
                          )
                        );
                      }}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Rules;
