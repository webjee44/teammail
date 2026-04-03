import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConversationList, Conversation } from "@/components/inbox/ConversationList";
import { ConversationDetail } from "@/components/inbox/ConversationDetail";
import { CommandMenu } from "@/components/inbox/CommandMenu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

import type { FileToUpload } from "@/components/inbox/Attachments";

type Message = {
  id: string;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  body_html: string | null;
  body_text: string | null;
  sent_at: string;
  is_outbound: boolean;
};

type Comment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name?: string;
};

const Index = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [hideNoise, setHideNoise] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [showAllMails, setShowAllMails] = useState(false);
  const [searchParams] = useSearchParams();
  const filter = searchParams.get("filter");
  const mailboxId = searchParams.get("mailbox");
  const { user } = useAuth();

  const handleSelectConversation = useCallback((id: string) => {
    // If it's a draft, navigate to Compose with draft id
    if (id.startsWith("draft-")) {
      const draftId = id.replace("draft-", "");
      navigate(`/compose?draft=${draftId}`);
      return;
    }
    setSelectedId(id);
  }, [navigate]);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Fetch conversations based on filter
  useEffect(() => {
    const fetchConversations = async () => {
      setLoading(true);

      // Special handling for drafts filter
      if (filter === "drafts") {
        if (!user) { setLoading(false); return; }
        const { data: drafts } = await supabase
          .from("drafts")
          .select("*")
          .is("conversation_id", null)
          .eq("created_by", user.id)
          .order("updated_at", { ascending: false });

        setConversations(
          (drafts || []).map((d: any) => ({
            id: `draft-${d.id}`,
            subject: d.subject || "(sans objet)",
            snippet: d.body?.slice(0, 100) || null,
            from_email: d.from_email,
            from_name: null,
            status: "open" as const,
            assigned_to: null,
            is_read: true,
            last_message_at: d.updated_at,
            tags: [],
            priority: null,
            is_noise: false,
            ai_summary: null,
            category: null,
            entities: null,
          }))
        );
        setLoading(false);
        return;
      }

      let query = supabase
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false });

      // Apply filter — skip status filter when showing all mails for a mailbox
      if (mailboxId && showAllMails) {
        // No status filter — show all
      } else if (filter === "snoozed") {
        query = query.eq("status", "snoozed");
      } else if (filter === "closed") {
        query = query.eq("status", "closed");
      } else if (filter === "mine") {
        query = query.eq("status", "open").eq("assigned_to", user?.id ?? "");
      } else if (filter === "unassigned") {
        query = query.eq("status", "open").is("assigned_to", null);
      } else {
        query = query.eq("status", "open");
      }

      if (mailboxId) {
        query = query.eq("mailbox_id", mailboxId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Failed to fetch conversations:", error);
        toast.error("Erreur lors du chargement des conversations");
      } else {
        setConversations(
          (data || []).map((c: any) => ({
            id: c.id,
            subject: c.subject,
            snippet: c.snippet,
            from_email: c.from_email,
            from_name: c.from_name,
            status: c.status as "open" | "snoozed" | "closed",
            assigned_to: c.assigned_to,
            is_read: c.is_read,
            last_message_at: c.last_message_at,
            tags: [],
            priority: c.priority,
            is_noise: c.is_noise,
            ai_summary: c.ai_summary,
            category: c.category,
            entities: c.entities,
          }))
        );
      }
      setLoading(false);
    };

    fetchConversations();
  }, [filter, mailboxId, user?.id, showAllMails]);

  // Fetch messages & comments when conversation is selected
  const fetchDetail = useCallback(async (convId: string) => {
    setLoadingDetail(true);
    const [msgRes, commentRes] = await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("sent_at", { ascending: true }),
      supabase
        .from("comments")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true }),
    ]);

    if (msgRes.data) {
      const messageIds = msgRes.data.map((m: any) => m.id);
      let attMap = new Map<string, any[]>();

      if (messageIds.length > 0) {
        const { data: attData } = await supabase
          .from("attachments")
          .select("*")
          .in("message_id", messageIds);

        if (attData) {
          for (const att of attData) {
            const list = attMap.get(att.message_id) || [];
            list.push(att);
            attMap.set(att.message_id, list);
          }
        }
      }

      setMessages(
        msgRes.data.map((m: any) => ({
          ...m,
          attachments: attMap.get(m.id) || [],
        }))
      );
    }
    if (commentRes.data) {
      setComments(
        commentRes.data.map((c) => ({
          id: c.id,
          user_id: c.user_id,
          body: c.body,
          created_at: c.created_at,
        }))
      );
    }
    setLoadingDetail(false);
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId);
      supabase
        .from("conversations")
        .update({ is_read: true })
        .eq("id", selectedId)
        .then();
      // Mark as read in Gmail too
      supabase.functions.invoke("gmail-mark-read", {
        body: { conversation_id: selectedId },
      }).catch((err) => console.error("Gmail mark-read failed:", err));
    }
  }, [selectedId, fetchDetail]);

  const selectedConv = selectedId
    ? conversations.find((c) => c.id === selectedId)
    : null;

  const selectedDetail = selectedConv
    ? {
        ...selectedConv,
        messages,
        comments,
      }
    : null;

  const handleStatusChange = async (id: string, status: "open" | "snoozed" | "closed") => {
    const { error } = await supabase
      .from("conversations")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );
    toast.success(`Statut → ${status === "open" ? "Ouvert" : status === "snoozed" ? "En pause" : "Fermé"}`);
  };

  const handleReply = async (id: string, body: string, attachedFiles?: FileToUpload[]) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv?.from_email) return;

    const { data: mailboxes } = await supabase
      .from("team_mailboxes")
      .select("email")
      .eq("sync_enabled", true)
      .limit(1);

    const fromEmail = mailboxes?.[0]?.email;
    if (!fromEmail) {
      toast.error("Aucune boîte mail configurée pour l'envoi");
      return;
    }

    const senderName = user?.user_metadata?.full_name || "";
    const gmailAttachments = attachedFiles?.map((f) => ({
      filename: f.name,
      mime_type: f.file.type || "application/octet-stream",
      data: f.base64,
    }));

    const { data, error } = await supabase.functions.invoke("gmail-send", {
      body: {
        to: conv.from_email,
        subject: `Re: ${conv.subject}`,
        body,
        from_email: fromEmail,
        from_name: senderName,
        attachments: gmailAttachments,
      },
    });

    if (error || data?.error) {
      toast.error("Erreur d'envoi : " + (data?.error || error?.message));
      return;
    }

    const { data: newMsg } = await supabase.from("messages").insert({
      conversation_id: id,
      from_email: fromEmail,
      from_name: user?.user_metadata?.full_name || fromEmail,
      to_email: conv.from_email,
      body_text: body,
      body_html: body.replace(/\n/g, "<br>"),
      is_outbound: true,
      gmail_message_id: data?.messageId || null,
    }).select("id").single();

    // Upload attachments to storage and save metadata
    if (newMsg && attachedFiles && attachedFiles.length > 0) {
      for (const f of attachedFiles) {
        const storagePath = `${id}/${newMsg.id}/${f.name}`;
        await supabase.storage.from("attachments").upload(storagePath, f.file, {
          contentType: f.file.type,
          upsert: true,
        });
        await supabase.from("attachments").insert({
          message_id: newMsg.id,
          filename: f.name,
          mime_type: f.file.type || "application/octet-stream",
          size_bytes: f.file.size,
          storage_path: storagePath,
        });
      }
    }

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", id);

    toast.success("Réponse envoyée");
    fetchDetail(id);
  };

  const handleComment = async (id: string, body: string) => {
    if (!user) return;
    const { error } = await supabase.from("comments").insert({
      conversation_id: id,
      user_id: user.id,
      body,
    });
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success("Note ajoutée");
    fetchDetail(id);
  };

  const handleDelete = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("gmail-archive", {
        body: { conversation_id: id },
      });
      if (error || data?.error) {
        toast.error("Erreur : " + (data?.error || error?.message));
        return;
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (selectedId === id) setSelectedId(null);
      toast.success("Conversation supprimée et archivée sur Gmail");
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || String(err)));
    }
  };

  const filteredConversations = hideNoise
    ? conversations.filter((c) => !c.is_noise)
    : conversations;

  const totalCount = conversations.length;
  const noiseCount = conversations.filter((c) => c.is_noise).length;

  const filterLabels: Record<string, string> = {
    mine: "Assigné à moi",
    unassigned: "Non assigné",
    snoozed: "En pause",
    closed: "Fermé",
    drafts: "Brouillons",
  };
  const headerTitle = filter ? filterLabels[filter] || "Boîte de réception" : "Boîte de réception";

  return (
    <AppLayout hideHeader>
      <div className="h-screen w-full flex flex-col">
        <div className="h-12 flex items-center px-3 border-b border-border gap-2 shrink-0">
          <SidebarTrigger />
          <h2 className="text-sm font-semibold text-foreground">{headerTitle}</h2>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-muted-foreground"
              onClick={() => setCommandOpen(true)}
            >
              <Search className="h-3.5 w-3.5" />
              <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </Button>
            <span className="text-xs text-muted-foreground">
              {totalCount} conversation{totalCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConversationList
            conversations={filteredConversations}
            selectedId={selectedId}
            onSelect={handleSelectConversation}
            loading={loading}
            hideNoise={hideNoise}
            onToggleNoise={() => setHideNoise(!hideNoise)}
            noiseCount={noiseCount}
            showAllMails={mailboxId ? showAllMails : undefined}
            onToggleAllMails={mailboxId ? () => setShowAllMails(!showAllMails) : undefined}
          />
        </div>
      </div>

      <Sheet open={!!selectedId} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <SheetContent side="right" className="sm:max-w-3xl w-[75vw] p-0 flex flex-col [&>button]:z-50">
          <ConversationDetail
            conversation={selectedDetail}
            onStatusChange={handleStatusChange}
            onReply={handleReply}
            onComment={handleComment}
            onDelete={handleDelete}
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
