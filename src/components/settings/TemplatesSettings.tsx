import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/inbox/conversation/RichTextEditor";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, FileText, Eye, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string | null;
  is_shared: boolean;
  usage_count: number;
  created_by: string;
  created_at: string;
}

const AVAILABLE_VARS = [
  { key: "nom", label: "Nom du destinataire" },
  { key: "email", label: "Email du destinataire" },
  { key: "entreprise", label: "Entreprise" },
  { key: "date", label: "Date du jour" },
  { key: "expediteur", label: "Votre nom" },
];

const EXAMPLE_VALUES: Record<string, string> = {
  nom: "Jean Dupont",
  email: "jean@example.com",
  entreprise: "Acme Corp",
  date: format(new Date(), "d MMMM yyyy", { locale: fr }),
  expediteur: "Vous",
};

export function TemplatesSettings() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editor state
  const [editing, setEditing] = useState<Template | null>(null);
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");
  const formBodyRef = useRef("");
  const [formCategory, setFormCategory] = useState("");
  const [formShared, setFormShared] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("email_templates")
      .select("*")
      .order("usage_count", { ascending: false });
    setTemplates((data as Template[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const existingCategories = Array.from(
    new Set(templates.map((t) => t.category).filter(Boolean) as string[])
  ).sort();

  const resetForm = () => {
    setEditing(null);
    setFormName("");
    setFormSubject("");
    setFormBody("");
    formBodyRef.current = "";
    setFormCategory("");
    setFormShared(true);
    setShowPreview(false);
    setShowEditor(false);
  };

  const startNew = () => {
    resetForm();
    setShowEditor(true);
  };

  const startEdit = (t: Template) => {
    setEditing(t);
    setFormName(t.name);
    setFormSubject(t.subject);
    setFormBody(t.body);
    formBodyRef.current = t.body;
    setFormCategory(t.category || "");
    setFormShared(t.is_shared);
    setShowPreview(false);
    setShowEditor(true);
  };

  const handleBodyChange = (html: string) => {
    formBodyRef.current = html;
    setFormBody(html);
  };

  const resolvePreview = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key) => EXAMPLE_VALUES[key] || `[${key}]`);

  const handleSave = async () => {
    const bodyToCheck = formBodyRef.current || formBody;
    const bodyTextOnly = bodyToCheck.replace(/<[^>]*>/g, '').trim();
    if (!formName.trim() || !bodyTextOnly) return;
    setSaving(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("user_id", user?.id ?? "")
        .single();
      if (!profile?.team_id) {
        toast.error("Aucune équipe trouvée");
        return;
      }

      if (editing) {
        const bodyToSave = formBodyRef.current || formBody;
        const { error } = await supabase
          .from("email_templates")
          .update({
            name: formName.trim(),
            subject: formSubject.trim(),
            body: bodyToSave,
            category: formCategory.trim() || null,
            is_shared: formShared,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Template mis à jour");
      } else {
        const bodyToSave = formBodyRef.current || formBody;
        const { error } = await supabase.from("email_templates").insert({
          name: formName.trim(),
          subject: formSubject.trim(),
          body: bodyToSave,
          category: formCategory.trim() || null,
          is_shared: formShared,
          team_id: profile.team_id,
          created_by: user!.id,
        });
        if (error) throw error;
        toast.success("Template créé");
      }

      resetForm();
      fetchTemplates();
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("email_templates").delete().eq("id", id);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success("Template supprimé");
    fetchTemplates();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Templates d'email</CardTitle>
          <CardDescription>
            Créez des modèles réutilisables avec des variables dynamiques
          </CardDescription>
        </div>
        <Button size="sm" className="gap-2" onClick={startNew}>
          <Plus className="h-4 w-4" /> Nouveau template
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Editor */}
        {showEditor && (
          <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                {editing ? "Modifier le template" : "Nouveau template"}
              </h3>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Annuler
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nom</Label>
                <Input
                  placeholder="Relance devis"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Catégorie</Label>
                <Input
                  placeholder="Commercial, Support, RH…"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  list="template-categories"
                />
                <datalist id="template-categories">
                  {existingCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Objet</Label>
              <Input
                placeholder="Re: Votre devis {{entreprise}}"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Corps du message</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs h-7"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="h-3 w-3" />
                  {showPreview ? "Éditer" : "Aperçu"}
                </Button>
              </div>
              {showPreview ? (
                <div className="min-h-[120px] p-3 rounded-md border border-input bg-background text-sm whitespace-pre-wrap">
                  {resolvePreview(formBody.replace(/<[^>]*>/g, ''))}
                </div>
              ) : (
                <RichTextEditor
                  value={formBody}
                  onChange={handleBodyChange}
                  placeholder="Bonjour {{nom}}, Suite à notre échange..."
                />
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Variables disponibles :</p>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_VARS.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => {
                      const varText = `{{${v.key}}}`;
                      const updated = formBodyRef.current
                        ? formBodyRef.current.replace(/<\/p>(?!.*<\/p>)/, `${varText}</p>`)
                        : varText;
                      handleBodyChange(updated);
                    }}
                    className="text-xs px-2 py-1 rounded-md border border-border bg-background hover:bg-accent transition-colors"
                    title={v.label}
                    type="button"
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="tpl-shared" checked={formShared} onCheckedChange={setFormShared} />
              <Label htmlFor="tpl-shared" className="text-sm">
                Partagé avec l'équipe
              </Label>
            </div>

            <Button
              onClick={handleSave}
              disabled={!formName.trim() || !formBody.replace(/<[^>]*>/g, '').trim() || saving}
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Mettre à jour" : "Créer"}
            </Button>
          </div>
        )}

        <Separator />

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Aucun template créé. Cliquez sur "Nouveau template" pour commencer.
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <div key={t.id} className="p-4 rounded-lg border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{t.name}</span>
                    {t.category && (
                      <Badge variant="secondary" className="text-xs">
                        {t.category}
                      </Badge>
                    )}
                    {!t.is_shared && (
                      <Badge variant="outline" className="text-xs">
                        Personnel
                      </Badge>
                    )}
                    {t.usage_count > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        {t.usage_count}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(t)}>
                      Modifier
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                {t.subject && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Objet :</span> {t.subject}
                  </p>
                )}
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {t.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
