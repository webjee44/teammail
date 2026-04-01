import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Mail, Users, Tag, Palette } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const mockMembers = [
  { id: "1", name: "Alex Moreau", email: "alex@company.com", role: "admin", avatar: "" },
  { id: "2", name: "Sarah Chen", email: "sarah@company.com", role: "member", avatar: "" },
  { id: "3", name: "Thomas Petit", email: "thomas@company.com", role: "member", avatar: "" },
];

const mockTags = [
  { id: "1", name: "Bug", color: "#ef4444" },
  { id: "2", name: "Feature", color: "#6366f1" },
  { id: "3", name: "Urgent", color: "#f59e0b" },
  { id: "4", name: "Sales", color: "#22c55e" },
];

const Settings = () => {
  const { user } = useAuth();
  const [inviteEmail, setInviteEmail] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");

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
              <CardHeader>
                <CardTitle className="text-base">Comptes Gmail connectés</CardTitle>
                <CardDescription>
                  Gérez les comptes Gmail synchronisés avec votre boîte collaborative
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{user?.email || "team@company.com"}</p>
                      <p className="text-xs text-muted-foreground">Connecté via Google OAuth</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Actif
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Settings;
