import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Inbox,
  User,
  Users,
  Clock,
  CheckCircle,
  Tag,
  Settings,
  BarChart3,
  Zap,
  LogOut,
  PenSquare,
  AtSign,
  ListTodo,
  FileEdit,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const toolItems = [
  { title: "Tâches", url: "/tasks", icon: ListTodo },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Règles", url: "/rules", icon: Zap },
  { title: "Statistiques", url: "/analytics", icon: BarChart3 },
  { title: "Paramètres", url: "/settings", icon: Settings },
];

export function InboxSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const activeMailbox = searchParams.get("mailbox");

  const [counts, setCounts] = useState({ open: 0, mine: 0, unassigned: 0, snoozed: 0, closed: 0, drafts: 0 });
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [mailboxes, setMailboxes] = useState<{ id: string; email: string; label: string | null; openCount: number }[]>([]);

  useEffect(() => {
    const fetchCounts = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("conversations")
        .select("id, status, assigned_to, mailbox_id");

      if (!data) return;
      // Fetch draft count
      const { count: draftCount } = await supabase
        .from("drafts")
        .select("id", { count: "exact", head: true })
        .is("conversation_id", null)
        .eq("created_by", user.id);

      setCounts({
        open: data.filter((c) => c.status === "open").length,
        mine: data.filter((c) => c.assigned_to === user.id).length,
        unassigned: data.filter((c) => !c.assigned_to && c.status === "open").length,
        snoozed: data.filter((c) => c.status === "snoozed").length,
        closed: data.filter((c) => c.status === "closed").length,
        drafts: draftCount || 0,
      });

      // Count open conversations per mailbox
      const mbCounts = new Map<string, number>();
      data.filter((c) => c.status === "open" && c.mailbox_id).forEach((c) => {
        mbCounts.set(c.mailbox_id!, (mbCounts.get(c.mailbox_id!) || 0) + 1);
      });

      // Fetch mailboxes
      const { data: mbData } = await supabase.from("team_mailboxes").select("id, email, label").order("email");
      if (mbData) {
        setMailboxes(mbData.map((mb) => ({ ...mb, openCount: mbCounts.get(mb.id) || 0 })));
      }
    };

    const fetchTags = async () => {
      const { data } = await supabase.from("tags").select("id, name, color").order("name");
      if (data) setTags(data);
    };

    fetchCounts();
    fetchTags();
  }, [user]);

  // Build URLs preserving the mailbox param
  const mbSuffix = activeMailbox ? `&mailbox=${activeMailbox}` : "";
  const inboxItems = [
    { title: "Boîte de réception", url: `/${activeMailbox ? `?mailbox=${activeMailbox}` : ""}`, icon: Inbox, count: counts.open },
    { title: "Assigné à moi", url: `/?filter=mine${mbSuffix}`, icon: User, count: counts.mine },
    { title: "Non assigné", url: `/?filter=unassigned${mbSuffix}`, icon: Users, count: counts.unassigned },
    { title: "En pause", url: `/?filter=snoozed${mbSuffix}`, icon: Clock, count: counts.snoozed },
    { title: "Fermé", url: `/?filter=closed${mbSuffix}`, icon: CheckCircle, count: counts.closed },
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
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Mail className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg text-sidebar-foreground">TeamMail</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {!collapsed && (
          <div className="px-3 mb-2">
            <Button size="sm" className="w-full gap-2" asChild>
              <NavLink to="/compose" activeClassName="">
                <PenSquare className="h-4 w-4" />
                Rédiger
              </NavLink>
            </Button>
          </div>
        )}

        {mailboxes.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Boîtes mail</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={searchParams.get("filter") ? `/?filter=${searchParams.get("filter")}` : "/"}
                      end={!searchParams.get("filter")}
                      className={`hover:bg-sidebar-accent/50 flex items-center justify-between ${!activeMailbox ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}`}
                      activeClassName=""
                    >
                      <span className="flex items-center gap-2">
                        <Inbox className="h-4 w-4" />
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
                  const isActive = activeMailbox === mb.id;
                  return (
                    <SidebarMenuItem key={mb.id}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={mbUrl}
                          className={`hover:bg-sidebar-accent/50 flex items-center justify-between ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}`}
                          activeClassName=""
                        >
                          <span className="flex items-center gap-2">
                            <AtSign className="h-4 w-4" />
                            {!collapsed && <span className="truncate">{mb.label || mb.email.split("@")[0]}</span>}
                          </span>
                          {!collapsed && mb.openCount > 0 && (
                            <Badge variant="secondary" className="text-xs h-5 min-w-[20px] justify-center">
                              {mb.openCount}
                            </Badge>
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

        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {inboxItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/50 flex items-center justify-between"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <span className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </span>
                      {!collapsed && item.count > 0 && (
                        <Badge variant="secondary" className="text-xs h-5 min-w-[20px] justify-center">
                          {item.count}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Étiquettes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tags.map((tag) => (
                <SidebarMenuItem key={tag.id}>
                  <SidebarMenuButton asChild>
                    <button className="flex items-center gap-2 w-full hover:bg-sidebar-accent/50 rounded-md px-2 py-1.5 text-sm">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      {!collapsed && <span>{tag.name}</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Outils</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-sidebar-foreground">
                {user?.user_metadata?.full_name || user?.email}
              </p>
            </div>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
