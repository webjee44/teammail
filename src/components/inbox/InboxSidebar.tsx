import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Inbox,
  User,
  Users,
  Settings,
  BarChart3,
  Zap,
  LogOut,
  PenSquare,
  ListTodo,
  FileEdit,
  Keyboard,
  Mail,
  MessageCircle,
  Megaphone,
  X,
  ChevronDown,
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
  { title: "Tâches", url: "/tasks", icon: ListTodo },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Règles", url: "/rules", icon: Zap },
  { title: "Statistiques", url: "/analytics", icon: BarChart3 },
  { title: "Paramètres", url: "/settings", icon: Settings },
];

type ConversationCounter = {
  id: string;
  status: string;
  assigned_to: string | null;
  mailbox_id: string | null;
  is_noise: boolean;
};

type MailboxScopedEmail = {
  id: string;
  from_email: string | null;
};

export function InboxSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeMailbox = searchParams.get("mailbox");
  const { openCompose } = useComposeWindow();

  const [conversations, setConversations] = useState<ConversationCounter[]>([]);
  const [actionableCount, setActionableCount] = useState(0);
  const [drafts, setDrafts] = useState<MailboxScopedEmail[]>([]);
  const [scheduledEmails, setScheduledEmails] = useState<MailboxScopedEmail[]>([]);
  const [waUnread, setWaUnread] = useState(0);
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [mailboxes, setMailboxes] = useState<{ id: string; email: string; label: string | null }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      const [convRes, actionableRes, draftRes, schedRes, mbRes, tagRes, waRes] = await Promise.all([
        supabase.from("conversations").select("id, status, assigned_to, mailbox_id, is_noise"),
        supabase.rpc("get_actionable_count", { _mailbox_id: activeMailbox || undefined }),
        supabase.from("drafts").select("id, from_email").is("conversation_id", null).eq("created_by", user.id),
        supabase.from("scheduled_emails").select("id, from_email").eq("status", "pending"),
        supabase.from("team_mailboxes").select("id, email, label").order("email"),
        supabase.from("tags").select("id, name, color").order("name"),
        supabase.from("whatsapp_conversations").select("id", { count: "exact", head: true }).eq("is_read", false).eq("status", "open"),
      ]);

      if (convRes.data) setConversations(convRes.data);
      setActionableCount(typeof actionableRes.data === "number" ? actionableRes.data : 0);
      if (draftRes.data) setDrafts(draftRes.data);
      if (schedRes.data) setScheduledEmails(schedRes.data);
      if (mbRes.data) setMailboxes(mbRes.data);
      if (tagRes.data) setTags(tagRes.data);
      setWaUnread(waRes.count || 0);
    };

    fetchData();
  }, [user, activeMailbox]);

  const activeMailboxData = useMemo(
    () => mailboxes.find((mailbox) => mailbox.id === activeMailbox) || null,
    [activeMailbox, mailboxes],
  );

  const counts = useMemo(() => {
    const mailboxScopedConversations = activeMailbox
      ? conversations.filter((conversation) => conversation.mailbox_id === activeMailbox)
      : conversations;

    const mailboxScopedEmail = activeMailboxData?.email ?? null;

    return {
      open: actionableCount,
      mine: mailboxScopedConversations.filter(
        (c) => c.status === "open" && !c.is_noise && c.assigned_to === user?.id,
      ).length,
      unassigned: mailboxScopedConversations.filter(
        (c) => c.status === "open" && !c.is_noise && !c.assigned_to,
      ).length,
      drafts: mailboxScopedEmail
        ? drafts.filter((draft) => draft.from_email === mailboxScopedEmail).length
        : drafts.length,
      scheduled: mailboxScopedEmail
        ? scheduledEmails.filter((email) => email.from_email === mailboxScopedEmail).length
        : scheduledEmails.length,
    };
  }, [activeMailbox, activeMailboxData, actionableCount, conversations, drafts, scheduledEmails, user?.id]);

  const selectMailbox = (mbId: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (mbId) {
      params.set("mailbox", mbId);
    } else {
      params.delete("mailbox");
    }
    setSearchParams(params, { replace: true });
  };

  const activeMailboxLabel = activeMailboxData
    ? activeMailboxData.label || activeMailboxData.email.split("@")[0]
    : null;

  const mbSuffix = activeMailbox ? `&mailbox=${activeMailbox}` : "";
  const inboxItems = [
    { title: "Boîte de réception", url: `/${activeMailbox ? `?mailbox=${activeMailbox}` : ""}`, icon: Inbox, count: counts.open },
    { title: "Assigné à moi", url: `/?filter=mine${mbSuffix}`, icon: User, count: counts.mine },
    
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
            <Button variant="outline" size="sm" className="w-full gap-2 h-8 border-dashed text-base font-medium" onClick={() => openCompose()}>
              <PenSquare className="h-3.5 w-3.5" />
              Rédiger
              <span className="ml-auto text-[10px] text-muted-foreground font-normal">C</span>
            </Button>
          )}
        </div>

        {/* Mailbox scope selector */}
        {mailboxes.length > 0 && !collapsed && (
          <div className="px-3 mt-2 mb-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] hover:bg-accent/50 transition-colors outline-none">
                  <Inbox className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-left truncate font-medium">
                    {activeMailboxLabel || "Toutes les boîtes"}
                  </span>
                  {activeMailbox && (
                    <span
                      role="button"
                      className="shrink-0 rounded-sm p-0.5 hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectMailbox(null);
                      }}
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem
                  onClick={() => selectMailbox(null)}
                  className={!activeMailbox ? "bg-accent" : ""}
                >
                  <Inbox className="h-3.5 w-3.5 mr-2" />
                  Toutes les boîtes
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {mailboxes.map((mb) => (
                  <DropdownMenuItem
                    key={mb.id}
                    onClick={() => selectMailbox(mb.id)}
                    className={activeMailbox === mb.id ? "bg-accent" : ""}
                  >
                    <Mail className="h-3.5 w-3.5 mr-2" />
                    <span className="truncate">{mb.label || mb.email.split("@")[0]}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
                      className="sidebar-item text-base"
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
                          className="sidebar-item text-base"
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
                    className="sidebar-item text-base"
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
                      className="sidebar-item text-base"
                      activeClassName="sidebar-item-active"
                    >
                      <span className="flex items-center gap-2">
                        <item.icon className="h-3.5 w-3.5" />
                        {!collapsed && <span>{item.title}</span>}
                      </span>
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
