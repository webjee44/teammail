import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConversationList, Conversation, InboxFilter } from "@/components/inbox/ConversationList";
import { computeInboxCounts } from "@/lib/inbox-metrics";
import { ConversationDetail } from "@/components/inbox/ConversationDetail";
import { CommandMenu } from "@/components/inbox/CommandMenu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Search, Trash2, CheckCircle, MailOpen, X } from "lucide-react";
import { useComposeWindow } from "@/hooks/useComposeWindow";
import { Button } from "@/components/ui/button";
import { useInboxMutations } from "@/hooks/useInboxMutations";
import { useInboxList } from "@/hooks/useInboxList";
import { useConversationDetail } from "@/hooks/useConversationDetail";
import { useConversationRealtime } from "@/hooks/useConversationRealtime";
import { useBulkActions } from "@/hooks/useBulkActions";

import { NotificationBell } from "@/components/inbox/NotificationBell";


const Index = () => {
  const navigate = useNavigate();
  const { openCompose } = useComposeWindow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("actionable");
  const [commandOpen, setCommandOpen] = useState(false);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get("filter");
  const mailboxId = searchParams.get("mailbox");
  const { user } = useAuth();

  // Dynamic mailbox fallback — no hardcoded UUID
  useEffect(() => {
    if (!searchParams.has("mailbox") && !filter) {
      supabase
        .from("team_mailboxes")
        .select("id")
        .eq("sync_enabled", true)
        .order("created_at")
        .limit(1)
        .then(({ data }) => {
          if (data?.[0]) {
            const params = new URLSearchParams(searchParams);
            params.set("mailbox", data[0].id);
            setSearchParams(params, { replace: true });
          }
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeState = filter === "archived" ? "archived"
    : filter === "trash" ? "trash"
    : filter === "spam" ? "spam"
    : "inbox";

  // ── Hooks ──
  const { conversations, setConversations, responseTimes, loading, refetch } = useInboxList({
    filter,
    mailboxId,
    userId: user?.id,
    activeState,
  });

  const {
    messages, setMessages, comments, loadingDetail, fetchDetail,
    handleComment, handleEditComment, handleDeleteComment,
  } = useConversationDetail(selectedId, user?.id);

  

  const {
    handleArchive, handleStatusChange, handleReply,
    handleBulkArchive, handleBulkStatusChange, handleBulkMarkRead,
    handleTrash, handleSpam,
    bulkLoading,
  } = useInboxMutations({
    conversations, setConversations, selectedId, setSelectedId,
    searchResults: null, mailboxId, user, messages, fetchDetail, refetch,
  });

  // Apply active filter — skip sub-filtering for special views
  const skipSubFilter = !!filter && ["sent", "drafts", "archived", "trash", "spam", "closed"].includes(filter);
  const filteredConversations = skipSubFilter
    ? conversations
    : conversations.filter((c) => {
        switch (activeFilter) {
          case "all": return c.status === "open";
          case "actionable": return c.status === "open" && !c.is_noise && c.needs_reply !== false;
          case "unread": return c.status === "open" && !c.is_noise && c.needs_reply !== false && !c.is_read;
          case "replied": return c.status === "open" && !c.is_noise && c.needs_reply === false;
          case "noise": return c.is_noise;
          default: return true;
        }
      });

  const { bulkSelected, handleBulkToggle, handleBulkSelectAll, handleBulkDeselectAll } = useBulkActions(filteredConversations);

  const { freshlyUpdated } = useConversationRealtime({
    activeState, selectedId, setSelectedId, setConversations, setMessages, filter, userId: user?.id, mailboxId,
  });

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if (isEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        openCompose();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [openCompose]);

  const handleSelectConversation = useCallback(async (id: string) => {
    if (id.startsWith("draft-")) {
      const draftId = id.replace("draft-", "");
      const { data: draft } = await supabase
        .from("drafts")
        .select("*")
        .eq("id", draftId)
        .maybeSingle();
      if (draft) {
        openCompose({
          to: draft.to_email || "",
          subject: draft.subject || "",
          body: draft.body || "",
          draftId: draft.id,
        });
      }
      return;
    }
    setSelectedId(id);
  }, [openCompose]);

  const selectedConv = selectedId
    ? (conversations.find((c) => c.id === selectedId) ?? null)
    : null;

  const selectedDetail = selectedConv
    ? { ...selectedConv, messages, comments }
    : null;

  const inboxCounts = computeInboxCounts(conversations.map(c => ({
    id: c.id, status: c.status, is_noise: c.is_noise ?? false,
    is_read: c.is_read, needs_reply: c.needs_reply, assigned_to: c.assigned_to,
  })));

  const filterCounts = {
    all: inboxCounts.all,
    actionable: inboxCounts.actionable,
    unread: inboxCounts.unread,
    replied: inboxCounts.replied,
    noise: inboxCounts.noise,
  };

  const displayedConversations = filteredConversations;
  const totalCount = displayedConversations.length;
  const isInboxView = !filter || filter === "mine" || filter === "unassigned";

  const filterLabels: Record<string, string> = {
    mine: "Assigné à moi",
    unassigned: "Non assigné",
    closed: "Fermé",
    sent: "Envoyés",
    drafts: "Brouillons",
    archived: "Archivées",
    trash: "Corbeille",
    spam: "Spam",
  };
  const headerTitle = filter ? filterLabels[filter] || "Boîte de réception" : "Boîte de réception";

  return (
    <AppLayout hideHeader>
      <div className="h-screen w-full flex flex-col">
        <div className="h-12 flex items-center px-3 border-b border-border gap-2 shrink-0">
          <SidebarTrigger />
          <h2 className="text-sm font-semibold text-foreground">{headerTitle}</h2>
          <button
            onClick={() => setCommandOpen(true)}
            className="flex-1 max-w-xs flex items-center gap-2 h-8 px-3 rounded-lg bg-muted/50 border border-border/50 hover:border-primary/50 hover:bg-muted transition-colors text-sm cursor-pointer"
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-left text-muted-foreground">Rechercher partout…</span>
            <kbd className="ml-auto pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground shrink-0">
              ⌘K
            </kbd>
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <NotificationBell onSelectConversation={(id) => { setSelectedId(id); }} />
            {isInboxView && filterCounts.actionable > 0 && (
              <span className="text-xs font-medium text-primary">
                {filterCounts.actionable} à traiter
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {totalCount} affichée{totalCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          {bulkSelected.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-primary/5 shrink-0">
              <span className="text-sm font-medium text-foreground">
                {bulkSelected.size} sélectionné(s)
              </span>
              <div className="flex items-center gap-1 ml-auto">
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => handleBulkMarkRead(bulkSelected, handleBulkDeselectAll)} disabled={bulkLoading}>
                  <MailOpen className="h-3.5 w-3.5" /> Lu
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => handleBulkStatusChange(bulkSelected, "closed", handleBulkDeselectAll)} disabled={bulkLoading}>
                  <CheckCircle className="h-3.5 w-3.5" /> Fermer
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => handleBulkArchive(bulkSelected, handleBulkDeselectAll)} disabled={bulkLoading}>
                  <Trash2 className="h-3.5 w-3.5" /> Archiver
                </Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={handleBulkDeselectAll} disabled={bulkLoading}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
          <ConversationList
            conversations={displayedConversations}
            selectedId={selectedId}
            onSelect={handleSelectConversation}
            loading={loading}
            activeFilter={activeFilter}
            onFilterChange={(f) => { setActiveFilter(f); }}
            filterCounts={filterCounts}
            showFilters={isInboxView}
            bulkSelected={bulkSelected}
            onBulkToggle={handleBulkToggle}
            onBulkSelectAll={handleBulkSelectAll}
            onBulkDeselectAll={handleBulkDeselectAll}
            responseTimes={responseTimes}
            freshlyUpdated={freshlyUpdated}
          />
        </div>
      </div>

      <Sheet open={!!selectedId} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <SheetContent side="right" className="sm:max-w-3xl w-[75vw] p-0 flex flex-col [&>button]:z-50">
          <ConversationDetail
            conversation={selectedDetail}
            currentUserId={user?.id}
            onStatusChange={handleStatusChange}
            onReply={handleReply}
            onComment={handleComment}
            onEditComment={handleEditComment}
            onDeleteComment={handleDeleteComment}
            onArchive={handleArchive}
          />
        </SheetContent>
      </Sheet>

      <CommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onSelect={setSelectedId}
      />
      
    </AppLayout>
  );
};

export default Index;
