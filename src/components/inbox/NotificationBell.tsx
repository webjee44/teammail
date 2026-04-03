import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Notification = {
  id: string;
  type: string;
  conversation_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  triggered_by: string | null;
  triggerer_name?: string;
};

type Props = {
  onSelectConversation?: (conversationId: string) => void;
};

export function NotificationBell({ onSelectConversation }: Props) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!data) return;

    // Fetch triggerer names
    const triggerIds = [...new Set(data.map((n: any) => n.triggered_by).filter(Boolean))];
    let nameMap = new Map<string, string>();
    if (triggerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", triggerIds);
      if (profiles) {
        profiles.forEach((p: any) => {
          nameMap.set(p.user_id, p.full_name || p.email || "?");
        });
      }
    }

    setNotifications(
      data.map((n: any) => ({
        ...n,
        triggerer_name: n.triggered_by ? nameMap.get(n.triggered_by) || "?" : undefined,
      }))
    );
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-" + user.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleClick = async (notif: Notification) => {
    // Mark as read
    if (!notif.is_read) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    }
    // Navigate to conversation
    if (notif.conversation_id && onSelectConversation) {
      onSelectConversation(notif.conversation_id);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative">
          <Bell className="h-3.5 w-3.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground px-1">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground"
              onClick={markAllRead}
            >
              Tout marquer lu
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Aucune notification
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors flex items-start gap-2.5",
                    !notif.is_read && "bg-primary/5"
                  )}
                >
                  <Avatar className="h-6 w-6 mt-0.5 shrink-0">
                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                      {notif.triggerer_name?.slice(0, 2).toUpperCase() ?? "@"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] leading-snug">
                      <span className="font-medium">{notif.triggerer_name}</span>{" "}
                      <span className="text-muted-foreground">{notif.message}</span>
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(notif.created_at), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </span>
                  </div>
                  {!notif.is_read && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
