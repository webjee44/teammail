import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  CalendarDays,
  Trash2,
  User,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assigned_to: string | null;
  created_by: string;
  conversation_id: string | null;
  due_date: string | null;
  created_at: string;
};

type Profile = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
};

const statusConfig: Record<string, { label: string; icon: typeof Circle; className: string }> = {
  todo: { label: "À faire", icon: Circle, className: "text-muted-foreground" },
  in_progress: { label: "En cours", icon: Clock, className: "text-amber-500" },
  done: { label: "Terminé", icon: CheckCircle2, className: "text-green-600" },
};

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("unassigned");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Erreur lors du chargement des tâches");
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, email");
    if (data) setProfiles(data);
  };

  useEffect(() => {
    fetchTasks();
    fetchProfiles();
  }, []);

  const handleCreate = async () => {
    if (!title.trim() || !user) return;
    setSaving(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.team_id) {
      toast.error("Aucune équipe trouvée");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("tasks").insert({
      team_id: profile.team_id,
      title: title.trim(),
      description: description.trim() || null,
      assigned_to: assignedTo === "unassigned" ? null : assignedTo,
      created_by: user.id,
      due_date: dueDate || null,
    });

    if (error) {
      toast.error("Erreur : " + error.message);
    } else {
      toast.success("Tâche créée");
      setTitle("");
      setDescription("");
      setAssignedTo("unassigned");
      setDueDate("");
      setDialogOpen(false);
      fetchTasks();
    }
    setSaving(false);
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", taskId);
    if (error) {
      toast.error("Erreur : " + error.message);
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
    }
  };

  const handleDelete = async (taskId: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      toast.error("Erreur : " + error.message);
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.success("Tâche supprimée");
    }
  };

  const handleAssignChange = async (taskId: string, userId: string) => {
    const value = userId === "unassigned" ? null : userId;
    const { error } = await supabase
      .from("tasks")
      .update({ assigned_to: value })
      .eq("id", taskId);
    if (error) {
      toast.error("Erreur : " + error.message);
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, assigned_to: value } : t))
      );
    }
  };

  const getProfile = (userId: string | null) =>
    profiles.find((p) => p.user_id === userId);

  const getInitials = (p: Profile | undefined) => {
    if (!p) return "?";
    if (p.full_name) return p.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    return p.email?.slice(0, 2).toUpperCase() ?? "?";
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === "mine") return t.assigned_to === user?.id;
    if (filter === "todo") return t.status === "todo";
    if (filter === "in_progress") return t.status === "in_progress";
    if (filter === "done") return t.status === "done";
    return true;
  });

  const nextStatus = (current: string) => {
    if (current === "todo") return "in_progress";
    if (current === "in_progress") return "done";
    return "todo";
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Tâches</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Nouvelle tâche
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une tâche</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Titre *</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Répondre au devis client"
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Détails optionnels..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Assigner à</Label>
                    <Select value={assignedTo} onValueChange={setAssignedTo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Non assigné" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Non assigné</SelectItem>
                        {profiles.map((p) => (
                          <SelectItem key={p.user_id} value={p.user_id}>
                            {p.full_name || p.email || "Utilisateur"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Échéance</Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={!title.trim() || saving}
                  className="w-full"
                >
                  {saving ? "Création..." : "Créer la tâche"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">Toutes</TabsTrigger>
            <TabsTrigger value="mine">Mes tâches</TabsTrigger>
            <TabsTrigger value="todo">À faire</TabsTrigger>
            <TabsTrigger value="in_progress">En cours</TabsTrigger>
            <TabsTrigger value="done">Terminé</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Aucune tâche</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => {
              const sc = statusConfig[task.status] || statusConfig.todo;
              const StatusIcon = sc.icon;
              const assignee = getProfile(task.assigned_to);
              const isOverdue =
                task.due_date &&
                task.status !== "done" &&
                new Date(task.due_date) < new Date();

              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors group",
                    task.status === "done" && "opacity-60"
                  )}
                >
                  {/* Status toggle */}
                  <button
                    onClick={() => handleStatusChange(task.id, nextStatus(task.status))}
                    className={cn("shrink-0", sc.className)}
                    title={`Passer à : ${statusConfig[nextStatus(task.status)].label}`}
                  >
                    <StatusIcon className="h-5 w-5" />
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium truncate",
                        task.status === "done" && "line-through text-muted-foreground"
                      )}
                    >
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Due date */}
                  {task.due_date && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 text-xs shrink-0",
                        isOverdue ? "border-destructive text-destructive" : "text-muted-foreground"
                      )}
                    >
                      <CalendarDays className="h-3 w-3" />
                      {format(new Date(task.due_date), "d MMM", { locale: fr })}
                    </Badge>
                  )}

                  {/* Assignee */}
                  <Select
                    value={task.assigned_to || "unassigned"}
                    onValueChange={(v) => handleAssignChange(task.id, v)}
                  >
                    <SelectTrigger className="w-auto h-7 border-0 bg-transparent shadow-none px-1 gap-1">
                      {assignee ? (
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={assignee.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px] bg-muted">
                            {getInitials(assignee)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Non assigné</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.full_name || p.email || "Utilisateur"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={() => handleDelete(task.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
