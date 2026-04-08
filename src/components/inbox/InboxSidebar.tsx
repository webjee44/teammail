import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Inbox,
  User,
  Users,
  Clock,
  CheckCircle,
  Settings,
  BarChart3,
  Zap,
  LogOut,
  PenSquare,
  AtSign,
  ListTodo,
  FileEdit,
  Keyboard,
  Mail,
  SendHorizonal,
  MessageCircle,
  Megaphone,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useComposeWindow } from "@/hooks/useComposeWindow";

const toolItems = [
  { title: "Campagnes", url: "/campaigns", icon: Megaphone },
  { title: "Tâches", url: "/tasks", icon: ListTodo, shortcut: "G T" },
  { title: "Contacts", url: "/contacts", icon: Users, shortcut: "G C" },
  { title: "Règles", url: "/rules", icon: Zap },
  { title: "Statistiques", url: "/analytics", icon: BarChart3 },
  { title: "Paramètres", url: "/settings", icon: Settings, shortcut: "G S" },
];

export function InboxSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const activeMailbox = searchParams.get("mailbox");
  const { openCompose } = useComposeWindow();

  const [counts, setCounts] = useState({ open: 0, mine: 0, unassigned: 0, snoozed: 0, closed: 0, drafts: 0, scheduled: 0, sent: 0 });
  const [waUnread, setWaUnread] = useState(0);
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [mailboxes, setMailboxes] = useState<{ id: string; email: string; label: string | null; openCount: number }[]>([]);

  useEffect(() => {
    const fetchCounts = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("conversations")
        .select("id, status, assigned_to, mailbox_id");

      if (!data) return;
      const { count: draftCount } = await supabase
        .from("drafts")
        .select("id", { count: "exact", head: true })
        .is("conversation_id", null)
        .eq("created_by", user.id);

      const { count: scheduledCount } = await supabase
        .from("scheduled_emails")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      // Count conversations with outbound messages
      const convIds = data.map((c) => c.id);
      let sentCount = 0;
      if (convIds.length > 0) {
        const { data: sentMsgs } = await supabase
          .from("messages")
          .select("conversation_id")
          .eq("is_outbound", true)
          .in("conversation_id", convIds);
        if (sentMsgs) {
          sentCount = new Set(sentMsgs.map((m) => m.conversation_id)).size;
        }
      }

      setCounts({
        open: data.filter((c) => c.status === "open").length,
        mine: data.filter((c) => c.assigned_to === user.id).length,
        unassigned: data.filter((c) => !c.assigned_to && c.status === "open").length,
        snoozed: data.filter((c) => c.status === "snoozed").length,
        closed: data.filter((c) => c.status === "closed").length,
        drafts: draftCount || 0,
        scheduled: scheduledCount || 0,
        sent: sentCount,
      });

      const mbCounts = new Map<string, number>();
      data.filter((c) => c.status === "open" && c.mailbox_id).forEach((c) => {
        mbCounts.set(c.mailbox_id!, (mbCounts.get(c.mailbox_id!) || 0) + 1);
      });

      const { data: mbData } = await supabase.from("team_mailboxes").select("id, email, label").order("email");
      if (mbData) {
        setMailboxes(mbData.map((mb) => ({ ...mb, openCount: mbCounts.get(mb.id) || 0 })));
      }
    };

    const fetchTags = async () => {
      const { data } = await supabase.from("tags").select("id, name, color").order("name");
      if (data) setTags(data);
    };

    const fetchWaUnread = async () => {
      const { count } = await supabase
        .from("whatsapp_conversations")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false)
        .eq("status", "open");
      setWaUnread(count || 0);
    };

    fetchCounts();
    fetchTags();
    fetchWaUnread();
  }, [user]);

  const mbSuffix = activeMailbox ? `&mailbox=${activeMailbox}` : "";
  const inboxItems = [
    { title: "Boîte de réception", url: `/${activeMailbox ? `?mailbox=${activeMailbox}` : ""}`, icon: Inbox, count: counts.open, shortcut: "G I" },
    { title: "Assigné à moi", url: `/?filter=mine${mbSuffix}`, icon: User, count: counts.mine, shortcut: "G M" },
    { title: "Non assigné", url: `/?filter=unassigned${mbSuffix}`, icon: Users, count: counts.unassigned },
    
    { title: "Fermé", url: `/?filter=closed${mbSuffix}`, icon: CheckCircle, count: counts.closed },
    { title: "Envoyés", url: `/?filter=sent${mbSuffix}`, icon: SendHorizonal, count: counts.sent },
    { title: "Brouillons", url: `/?filter=drafts${mbSuffix}`, icon: FileEdit, count: counts.drafts },
    { title: "Programmés", url: "/scheduled", icon: Mail, count: counts.scheduled },
  ];

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Header */}
      <SidebarHeader className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Mail className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-[15px] text-sidebar-foreground">TeamMail</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Compose button */}
        <div className="px-3 mb-1">
          {collapsed ? (
            <Button size="icon" variant="outline" className="w-8 h-8 border-dashed" onClick={() => openCompose()}>
              <PenSquare className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="w-full gap-2 h-8 border-dashed text-[13px] font-medium" onClick={() => openCompose()}>
              <PenSquare className="h-3.5 w-3.5" />
              Rédiger
              <span className="ml-auto text-[10px] text-muted-foreground font-normal">C</span>
            </Button>
          )}
        </div>

        {/* Mailboxes */}
        {mailboxes.length > 0 && (
          <SidebarGroup className="mt-2">
            {!collapsed && (
              <span className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
                Boîtes mail
              </span>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="h-7">
                    <NavLink
                      to={searchParams.get("filter") ? `/?filter=${searchParams.get("filter")}` : "/"}
                      end={!searchParams.get("filter")}
                      className="sidebar-item"
                      activeClassName="sidebar-item-active"
                    >
                      <span className="flex items-center gap-2">
                        <Inbox className="h-3.5 w-3.5" />
                        {!collapsed && <span>Toutes</span>}
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {mailboxes.map((mb) => {
                  const filterParam = searchParams.get("filter");
                  const mbUrl = filterParam
                    ? `/?filter=${filterParam}&mailbox=${mb.id}`
                    : `/?mailbox=${mb.id}`;
                  return (
                    <SidebarMenuItem key={mb.id}>
                      <SidebarMenuButton asChild className="h-7">
                        <NavLink
                          to={mbUrl}
                          className="sidebar-item"
                          activeClassName="sidebar-item-active"
                        >
                          <span className="flex items-center gap-2">
                            <AtSign className="h-3.5 w-3.5" />
                            {!collapsed && <span className="truncate">{mb.label || mb.email.split("@")[0]}</span>}
                          </span>
                          {!collapsed && mb.openCount > 0 && (
                            <span className="text-xs tabular-nums text-muted-foreground">{mb.openCount}</span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <Separator className="mx-3 my-1 w-auto" />

        {/* Conversations */}
        <SidebarGroup className="mt-1">
          {!collapsed && (
            <span className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
              Conversations
            </span>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {inboxItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-7">
                    <NavLink
                      to={item.url}
                      end
                      className="sidebar-item"
                      activeClassName="sidebar-item-active"
                    >
                      <span className="flex items-center gap-2">
                        <item.icon className="h-3.5 w-3.5" />
                        {!collapsed && <span>{item.title}</span>}
                      </span>
                      {!collapsed && (
                        <span className="flex items-center gap-2 ml-auto">
                          {item.count > 0 && (
                            <span className="text-xs tabular-nums text-muted-foreground">{item.count}</span>
                          )}
                          {"shortcut" in item && item.shortcut && (
                            <span className="text-[10px] text-muted-foreground/50 font-mono">{item.shortcut}</span>
                          )}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tags */}
        {tags.length > 0 && (
          <>
            <Separator className="mx-3 my-1 w-auto" />
            <SidebarGroup className="mt-1">
              {!collapsed && (
                <span className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
                  Étiquettes
                </span>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {tags.map((tag) => (
                    <SidebarMenuItem key={tag.id}>
                      <SidebarMenuButton asChild className="h-7">
                        <NavLink
                          to={`/?tag=${tag.id}${activeMailbox ? `&mailbox=${activeMailbox}` : ""}`}
                          className="sidebar-item"
                          activeClassName="sidebar-item-active"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: tag.color }}
                            />
                            {!collapsed && <span>{tag.name}</span>}
                          </span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* WhatsApp */}
        <Separator className="mx-3 my-1 w-auto" />
        <SidebarGroup className="mt-1">
          {!collapsed && (
            <span className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
              Canaux
            </span>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="h-7">
                  <NavLink
                    to="/whatsapp"
                    className="sidebar-item"
                    activeClassName="sidebar-item-active"
                  >
                    <span className="flex items-center gap-2">
                      <MessageCircle className="h-3.5 w-3.5 text-green-500" />
                      {!collapsed && <span>WhatsApp</span>}
                    </span>
                    {!collapsed && waUnread > 0 && (
                      <span className="ml-auto text-xs tabular-nums text-green-600 font-medium">{waUnread}</span>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="mx-3 my-1 w-auto" />

        {/* Tools */}
        <SidebarGroup className="mt-1">
          {!collapsed && (
            <span className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
              Outils
            </span>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {toolItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-7">
                    <NavLink
                      to={item.url}
                      className="sidebar-item"
                      activeClassName="sidebar-item-active"
                    >
                      <span className="flex items-center gap-2">
                        <item.icon className="h-3.5 w-3.5" />
                        {!collapsed && <span>{item.title}</span>}
                      </span>
                      {!collapsed && item.shortcut && (
                        <span className="ml-auto text-[10px] text-muted-foreground/50 font-mono">{item.shortcut}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer – user dropdown */}
      <SidebarFooter className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 hover:bg-sidebar-accent/40 transition-colors duration-150 outline-none">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-[11px] bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <span className="flex-1 min-w-0 text-left">
                  <span className="block text-[13px] font-medium truncate text-sidebar-foreground">
                    {user?.user_metadata?.full_name || user?.email}
                  </span>
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <NavLink to="/settings" className="cursor-pointer" activeClassName="">
                <Settings className="h-3.5 w-3.5 mr-2" />
                Paramètres
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
              <Keyboard className="h-3.5 w-3.5 mr-2" />
              Raccourcis clavier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
