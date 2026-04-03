import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Clock, Trash2, CalendarIcon, Loader2, Mail, RefreshCw, SendHorizonal, Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useComposeWindow } from "@/hooks/useComposeWindow";

type ScheduledEmail = {
  id: string;
  to_email: string;
  subject: string;
  body: string;
  from_email: string;
  scheduled_at: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

const ScheduledEmails = () => {
  const { user } = useAuth();
  const { openCompose } = useComposeWindow();
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>();
  const [rescheduleTime, setRescheduleTime] = useState("09:00");
  const [rescheduling, setRescheduling] = useState(false);

  const fetchEmails = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("scheduled_emails")
      .select("*")
      .order("scheduled_at", { ascending: true });

    if (error) {
      toast.error("Erreur lors du chargement");
      console.error(error);
    } else {
      setEmails(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const handleCancel = async (id: string) => {
    const { error } = await supabase
      .from("scheduled_emails")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success("Email programmé annulé");
    setEmails((prev) => prev.filter((e) => e.id !== id));
  };

  const handleReschedule = async () => {
    if (!rescheduleId || !rescheduleDate) return;
    const [hours, minutes] = rescheduleTime.split(":").map(Number);
    const scheduledAt = new Date(rescheduleDate);
    scheduledAt.setHours(hours, minutes, 0, 0);
    if (scheduledAt <= new Date()) {
      toast.error("La date doit être dans le futur");
      return;
    }
    setRescheduling(true);
    const { error } = await supabase
      .from("scheduled_emails")
      .update({ scheduled_at: scheduledAt.toISOString(), status: "pending", error_message: null })
      .eq("id", rescheduleId);
    if (error) {
      toast.error("Erreur : " + error.message);
    } else {
      toast.success(`Reprogrammé pour le ${format(scheduledAt, "d MMMM à HH:mm", { locale: fr })}`);
      setRescheduleId(null);
      fetchEmails();
    }
    setRescheduling(false);
  };

  const pendingEmails = emails.filter((e) => e.status === "pending");
  const sentEmails = emails.filter((e) => e.status === "sent");
  const failedEmails = emails.filter((e) => e.status === "failed" || e.status === "error");

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 text-amber-600"><Clock className="h-2.5 w-2.5" />En attente</Badge>;
      case "sent":
        return <Badge variant="outline" className="text-[10px] gap-1 border-green-500/30 text-green-600"><SendHorizonal className="h-2.5 w-2.5" />Envoyé</Badge>;
      default:
        return <Badge variant="destructive" className="text-[10px] gap-1">Erreur</Badge>;
    }
  };

  const EmailRow = ({ email }: { email: ScheduledEmail }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
      <div className="shrink-0 mt-0.5">
        <Mail className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{email.subject || "(sans objet)"}</span>
          {statusBadge(email.status)}
        </div>
        <div className="text-xs text-muted-foreground">
          À : {email.to_email} · De : {email.from_email}
        </div>
        <div className="text-xs text-muted-foreground">
          <Clock className="h-3 w-3 inline mr-1" />
          {format(new Date(email.scheduled_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
        </div>
        {email.error_message && (
          <div className="text-xs text-destructive mt-1">{email.error_message}</div>
        )}
        <div className="text-xs text-muted-foreground/60 line-clamp-2 mt-1">{email.body?.replace(/<[^>]*>/g, "").slice(0, 200)}</div>
      </div>
      {email.status === "pending" && (
        <div className="flex gap-1 shrink-0">
          <Popover
            open={rescheduleId === email.id}
            onOpenChange={(open) => {
              if (open) {
                setRescheduleId(email.id);
                setRescheduleDate(new Date(email.scheduled_at));
                const d = new Date(email.scheduled_at);
                setRescheduleTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
              } else {
                setRescheduleId(null);
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs">
                <RefreshCw className="h-3 w-3" />
                Reprogrammer
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal text-xs", !rescheduleDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {rescheduleDate ? format(rescheduleDate, "d MMMM yyyy", { locale: fr }) : "Choisir"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={rescheduleDate}
                        onSelect={setRescheduleDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Heure</Label>
                  <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className="h-8 text-xs" />
                </div>
                <Button onClick={handleReschedule} disabled={!rescheduleDate || rescheduling} className="w-full gap-2" size="sm">
                  {rescheduling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
                  Confirmer
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3" />
                Annuler
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Annuler cet envoi ?</AlertDialogTitle>
                <AlertDialogDescription>
                  L'email programmé pour {email.to_email} sera définitivement supprimé.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Non</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleCancel(email.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Oui, annuler
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      {(email.status === "failed" || email.status === "error") && (
        <div className="flex gap-1 shrink-0">
          <Popover
            open={rescheduleId === email.id}
            onOpenChange={(open) => {
              if (open) {
                setRescheduleId(email.id);
                setRescheduleDate(undefined);
                setRescheduleTime("09:00");
              } else {
                setRescheduleId(null);
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs">
                <RefreshCw className="h-3 w-3" />
                Réessayer
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal text-xs", !rescheduleDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {rescheduleDate ? format(rescheduleDate, "d MMMM yyyy", { locale: fr }) : "Choisir"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={rescheduleDate}
                        onSelect={setRescheduleDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Heure</Label>
                  <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className="h-8 text-xs" />
                </div>
                <Button onClick={handleReschedule} disabled={!rescheduleDate || rescheduling} className="w-full gap-2" size="sm">
                  {rescheduling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
                  Reprogrammer
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cet email ?</AlertDialogTitle>
                <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Non</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleCancel(email.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="flex-1 p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Emails programmés</h1>
          <Button variant="outline" size="sm" onClick={fetchEmails} disabled={loading} className="gap-1">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Actualiser
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Aucun email programmé</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending */}
            {pendingEmails.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  En attente ({pendingEmails.length})
                </h2>
                <div className="space-y-2">
                  {pendingEmails.map((e) => <EmailRow key={e.id} email={e} />)}
                </div>
              </div>
            )}

            {/* Failed */}
            {failedEmails.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-medium uppercase tracking-wider text-destructive">
                  En erreur ({failedEmails.length})
                </h2>
                <div className="space-y-2">
                  {failedEmails.map((e) => <EmailRow key={e.id} email={e} />)}
                </div>
              </div>
            )}

            {/* Sent */}
            {sentEmails.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Envoyés ({sentEmails.length})
                </h2>
                <div className="space-y-2">
                  {sentEmails.map((e) => <EmailRow key={e.id} email={e} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ScheduledEmails;
