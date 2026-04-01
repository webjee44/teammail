import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Mail, Users, Tag, RefreshCw, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const mockMembers = [
  { id: "1", name: "Alex Moreau", email: "alex@company.com", role: "admin" as const, avatar: "" },
  { id: "2", name: "Sarah Chen", email: "sarah@company.com", role: "membre" as const, avatar: "" },
  { id: "3", name: "Thomas Petit", email: "thomas@company.com", role: "membre" as const, avatar: "" },
];

const mockTags = [
  { id: "1", name: "Bug", color: "#ef4444" },
  { id: "2", name: "Fonctionnalité", color: "#6366f1" },
  { id: "3", name: "Urgent", color: "#f59e0b" },
  { id: "4", name: "Ventes", color: "#22c55e" },
];

type Mailbox = Tables<"team_mailboxes">;

const Settings = () => {
  const { user } = useAuth();
  const [inviteEmail, setInviteEmail] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");

  // Mailbox state
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [newMailboxEmail, setNewMailboxEmail] = useState("");
  const [newMailboxLabel, setNewMailboxLabel] = useState("");
  const [loadingMailboxes, setLoadingMailboxes] = useState(true);
  const [addingMailbox, setAddingMailbox] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchMailboxes = async () => {
    const { data, error } = await supabase
      .from("team_mailboxes")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Failed to fetch mailboxes:", error);
    } else {
      setMailboxes(data || []);
    }
    setLoadingMailboxes(false);
  };

  useEffect(() => {
    fetchMailboxes();
  }, []);

  const addMailbox = async () => {
    if (!newMailboxEmail) return;
    setAddingMailbox(true);
    try {
      // Get user's team_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("user_id", user?.id ?? "")
        .single();

      if (!profile?.team_id) {
        toast.error("Aucune équipe trouvée. Créez d'abord une équipe.");
        return;
      }

      const { error } = await supabase.from("team_mailboxes").insert({
        email: newMailboxEmail.trim().toLowerCase(),
        label: newMailboxLabel.trim() || null,
        team_id: profile.team_id,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Cette adresse email est déjà configurée");
        } else {
          toast.error("Erreur lors de l'ajout : " + error.message);
        }
        return;
      }

      toast.success(`Boîte mail ${newMailboxEmail} ajoutée`);
      setNewMailboxEmail("");
      setNewMailboxLabel("");
      fetchMailboxes();
    } finally {
      setAddingMailbox(false);
    }
  };

  const deleteMailbox = async (id: string, email: string) => {
    const { error } = await supabase.from("team_mailboxes").delete().eq("id", id);
    if (error) {
      toast.error("Erreur lors de la suppression : " + error.message);
      return;
    }
    toast.success(`Boîte mail ${email} supprimée`);
    setMailboxes((prev) => prev.filter((m) => m.id !== id));
  };

  const toggleSync = async (id: string, enabled: boolean) => {
    const { error } = await supabase
      .from("team_mailboxes")
      .update({ sync_enabled: enabled })
      .eq("id", id);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    setMailboxes((prev) =>
      prev.map((m) => (m.id === id ? { ...m, sync_enabled: enabled } : m))
    );
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-sync");
      if (error) throw error;
      toast.success("Synchronisation terminée");
      fetchMailboxes();
    } catch (err: any) {
      toast.error("Erreur de synchronisation : " + (err.message || String(err)));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez votre équipe, tags et comptes connectés
          </p>
        </div>

        <Tabs defaultValue="team">
          <TabsList>
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" /> Équipe
            </TabsTrigger>
            <TabsTrigger value="tags" className="gap-2">
              <Tag className="h-4 w-4" /> Tags
            </TabsTrigger>
            <TabsTrigger value="accounts" className="gap-2">
              <Mail className="h-4 w-4" /> Comptes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Membres de l'équipe</CardTitle>
                <CardDescription>Invitez et gérez les membres de votre équipe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="email@example.com"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => {
                      toast.success(`Invitation envoyée à ${inviteEmail}`);
                      setInviteEmail("");
                    }}
                    disabled={!inviteEmail}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" /> Inviter
                  </Button>
                </div>

                <Separator />

                <div className="space-y-3">
                  {mockMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback className="text-xs bg-muted">
                            {member.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                          {member.role}
                        </Badge>
                        {member.role !== "admin" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tags" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tags</CardTitle>
                <CardDescription>Créez et gérez les tags pour organiser vos conversations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nouveau tag..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <Button
                      onClick={() => {
                        toast.success(`Tag "${newTagName}" créé`);
                        setNewTagName("");
                      }}
                      disabled={!newTagName}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" /> Ajouter
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  {mockTags.map((tag) => (
                    <div key={tag.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm">{tag.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Boîtes mail synchronisées</CardTitle>
                  <CardDescription>
                    Ajoutez les adresses email de votre domaine à synchroniser via Gmail
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={triggerSync}
                  disabled={syncing || mailboxes.length === 0}
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Synchroniser
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="contact@votredomaine.com"
                    type="email"
                    value={newMailboxEmail}
                    onChange={(e) => setNewMailboxEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Label (optionnel)"
                    value={newMailboxLabel}
                    onChange={(e) => setNewMailboxLabel(e.target.value)}
                    className="w-40"
                  />
                  <Button
                    onClick={addMailbox}
                    disabled={!newMailboxEmail || addingMailbox}
                    className="gap-2"
                  >
                    {addingMailbox ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Ajouter
                  </Button>
                </div>

                <Separator />

                {loadingMailboxes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : mailboxes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Aucune boîte mail configurée. Ajoutez une adresse email pour commencer la synchronisation.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mailboxes.map((mailbox) => (
                      <div
                        key={mailbox.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Mail className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {mailbox.email}
                              {mailbox.label && (
                                <span className="ml-2 text-muted-foreground font-normal">
                                  ({mailbox.label})
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {mailbox.last_sync_at
                                ? `Dernière sync : ${new Date(mailbox.last_sync_at).toLocaleString("fr-FR")}`
                                : "Jamais synchronisé"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`sync-${mailbox.id}`} className="text-xs text-muted-foreground">
                              Sync
                            </Label>
                            <Switch
                              id={`sync-${mailbox.id}`}
                              checked={mailbox.sync_enabled}
                              onCheckedChange={(checked) => toggleSync(mailbox.id, checked)}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => deleteMailbox(mailbox.id, mailbox.email)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Settings;
