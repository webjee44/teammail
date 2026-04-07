import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, FileText, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string | null;
  usage_count: number;
}

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (subject: string, body: string) => void;
  recipientEmail?: string;
  senderName?: string;
}

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

const EXAMPLE_VALUES: Record<string, string> = {
  nom: "Jean Dupont",
  email: "jean@example.com",
  entreprise: "Acme Corp",
  date: format(new Date(), "d MMMM yyyy", { locale: fr }),
  expediteur: "Vous",
};

export function TemplatePickerDialog({
  open,
  onOpenChange,
  onInsert,
  recipientEmail,
  senderName,
}: TemplatePickerDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Template | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelected(null);
    setVariableValues({});
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("email_templates")
        .select("id, name, subject, body, category, usage_count")
        .order("usage_count", { ascending: false });
      setTemplates(data || []);
      setLoading(false);
    };
    load();
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        t.subject.toLowerCase().includes(q)
    );
  }, [templates, search]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    filtered.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort();
  }, [filtered]);

  const grouped = useMemo(() => {
    const map: Record<string, Template[]> = {};
    const uncategorized: Template[] = [];
    filtered.forEach((t) => {
      if (t.category) {
        if (!map[t.category]) map[t.category] = [];
        map[t.category].push(t);
      } else {
        uncategorized.push(t);
      }
    });
    return { map, uncategorized };
  }, [filtered]);

  const extractVariables = (text: string): string[] => {
    const vars = new Set<string>();
    let match;
    const regex = new RegExp(VARIABLE_REGEX.source, "g");
    while ((match = regex.exec(text)) !== null) {
      vars.add(match[1]);
    }
    return Array.from(vars);
  };

  const handleSelect = (template: Template) => {
    setSelected(template);
    const vars = extractVariables(template.body + " " + template.subject);
    const autoValues: Record<string, string> = {};
    vars.forEach((v) => {
      if (v === "email" && recipientEmail) autoValues[v] = recipientEmail;
      else if (v === "date") autoValues[v] = format(new Date(), "d MMMM yyyy", { locale: fr });
      else if (v === "expediteur" && senderName) autoValues[v] = senderName;
      else autoValues[v] = "";
    });
    setVariableValues(autoValues);
  };

  const resolveText = (text: string) => {
    return text.replace(VARIABLE_REGEX, (_, key) => variableValues[key] || `{{${key}}}`);
  };

  const handleInsert = async () => {
    if (!selected) return;
    const resolvedSubject = resolveText(selected.subject);
    const resolvedBody = resolveText(selected.body);

    // Increment usage_count
    supabase
      .from("email_templates")
      .update({ usage_count: selected.usage_count + 1 })
      .eq("id", selected.id)
      .then();

    onInsert(resolvedSubject, resolvedBody);
    onOpenChange(false);
  };

  const unresolvedVars = selected
    ? Object.entries(variableValues).filter(([, v]) => !v)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Insérer un template
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou catégorie..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 max-h-[50vh]">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucun template trouvé
                </p>
              ) : (
                <>
                  {categories.map((cat) => (
                    <div key={cat}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        {cat}
                      </p>
                      <div className="space-y-1">
                        {grouped.map[cat].map((t) => (
                          <TemplateRow key={t.id} template={t} onClick={() => handleSelect(t)} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {grouped.uncategorized.length > 0 && (
                    <div>
                      {categories.length > 0 && (
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Autres
                        </p>
                      )}
                      <div className="space-y-1">
                        {grouped.uncategorized.map((t) => (
                          <TemplateRow key={t.id} template={t} onClick={() => handleSelect(t)} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto max-h-[60vh]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{selected.name}</h3>
                {selected.category && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {selected.category}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                ← Retour
              </Button>
            </div>

            <Separator />

            {unresolvedVars.length > 0 && (
              <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
                <p className="text-sm font-medium">Renseignez les variables</p>
                {Object.keys(variableValues).map((key) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs capitalize">{`{{${key}}}`}</Label>
                    <Input
                      placeholder={EXAMPLE_VALUES[key] || `Valeur pour ${key}`}
                      value={variableValues[key]}
                      onChange={(e) =>
                        setVariableValues((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Aperçu</Label>
              <div className="p-3 rounded-md border border-border bg-muted/20 space-y-2">
                {selected.subject && (
                  <p className="text-sm">
                    <span className="font-medium">Objet :</span>{" "}
                    {resolveText(selected.subject)}
                  </p>
                )}
                <div
                  className="text-sm prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: resolveText(selected.body) }}
                />
              </div>
            </div>

            <Button onClick={handleInsert} className="w-full">
              Insérer ce template
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplateRow({
  template,
  onClick,
}: {
  template: Template;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{template.name}</span>
        {template.usage_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            {template.usage_count}
          </span>
        )}
      </div>
      {template.subject && (
        <p className="text-xs text-muted-foreground mt-1 truncate">{template.subject}</p>
      )}
      <div
        className="text-xs text-muted-foreground mt-0.5 line-clamp-2"
        dangerouslySetInnerHTML={{ __html: template.body.slice(0, 200) }}
      />
    </button>
  );
}
