import { useState, useEffect, useCallback, useRef } from "react";
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
import { Search, Trash2, CheckCircle, Clock, MailOpen, X } from "lucide-react";
import { useComposeWindow } from "@/hooks/useComposeWindow";
import { Button } from "@/components/ui/button";

import { NotificationBell } from "@/components/inbox/NotificationBell";

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
  const { openCompose } = useComposeWindow();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [responseTimes, setResponseTimes] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [hideNoise, setHideNoise] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [showAllMails, setShowAllMails] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const filter = searchParams.get("filter");
  const mailboxId = searchParams.get("mailbox");
  const { user } = useAuth();

  const handleSelectConversation = useCallback(async (id: string) => {
    // If it's a draft, load it and open in compose window
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

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K → command palette
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
        return;
      }
      // Ignore shortcuts when typing in an input/textarea/contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if (isEditable) return;
      // C → compose
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        openCompose();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [openCompose]);

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

      // Special handling for sent filter — conversations with outbound messages
      if (filter === "sent") {
        // Get conversation IDs that have outbound messages
        let sentQuery = supabase
          .from("messages")
          .select("conversation_id")
          .eq("is_outbound", true);

        const { data: sentMsgs } = await sentQuery;
        const sentConvIds = [...new Set((sentMsgs || []).map((m) => m.conversation_id))];

        if (sentConvIds.length === 0) {
          setConversations([]);
          setLoading(false);
          return;
        }

        let convQuery = supabase
          .from("conversations")
          .select("*")
          .in("id", sentConvIds)
          .order("last_message_at", { ascending: false });

        if (mailboxId) {
          convQuery = convQuery.eq("mailbox_id", mailboxId);
        }

        const { data, error } = await convQuery;
        if (error) {
          console.error("Failed to fetch sent conversations:", error);
          toast.error("Erreur lors du chargement des conversations envoyées");
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
        // Fetch conversation IDs that have drafts
        const convIds = (data || []).map((c: any) => c.id);
        let draftConvIds = new Set<string>();
        if (convIds.length > 0 && user) {
          const { data: draftData } = await supabase
            .from("drafts")
            .select("conversation_id")
            .in("conversation_id", convIds)
            .eq("created_by", user.id);
          if (draftData) {
            draftConvIds = new Set(draftData.map((d: any) => d.conversation_id).filter(Boolean));
          }
        }

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
            has_draft: draftConvIds.has(c.id),
          }))
        );
      }
      // Calculate response times for loaded conversations
      const convIds = (data || []).map((c: any) => c.id);
      if (convIds.length > 0) {
        const { data: allMsgs } = await supabase
          .from("messages")
          .select("conversation_id, is_outbound, sent_at")
          .in("conversation_id", convIds)
          .order("sent_at", { ascending: true });
        if (allMsgs) {
          const rtMap = new Map<string, number>();
          const byConvo = new Map<string, typeof allMsgs>();
          for (const m of allMsgs) {
            const list = byConvo.get(m.conversation_id) || [];
            list.push(m);
            byConvo.set(m.conversation_id, list);
          }
          for (const [cid, msgs] of byConvo) {
            const times: number[] = [];
            for (let i = 0; i < msgs.length; i++) {
              if (!msgs[i].is_outbound) {
                for (let j = i + 1; j < msgs.length; j++) {
                  if (msgs[j].is_outbound) {
                    const diff = (new Date(msgs[j].sent_at).getTime() - new Date(msgs[i].sent_at).getTime()) / 60000;
                    if (diff > 0 && diff < 1440) times.push(diff);
                    break;
                  }
                }
              }
            }
            if (times.length > 0) {
              rtMap.set(cid, times.reduce((a, b) => a + b, 0) / times.length);
            }
          }
          setResponseTimes(rtMap);
        }
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

  // Realtime: conversations
  useEffect(() => {
    const channel = supabase
      .channel('rt-conversations')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        (payload) => {
          const c = payload.new as any;
          setConversations((prev) => {
            if (prev.some((x) => x.id === c.id)) return prev;
            return [{
              id: c.id, subject: c.subject, snippet: c.snippet,
              from_email: c.from_email, from_name: c.from_name,
              status: c.status, assigned_to: c.assigned_to,
              is_read: c.is_read, last_message_at: c.last_message_at,
              tags: [], priority: c.priority, is_noise: c.is_noise,
              ai_summary: c.ai_summary, category: c.category, entities: c.entities,
            }, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          const c = payload.new as any;
          setConversations((prev) =>
            prev.map((x) => x.id === c.id ? {
              ...x, subject: c.subject, snippet: c.snippet, status: c.status,
              assigned_to: c.assigned_to, is_read: c.is_read,
              last_message_at: c.last_message_at, priority: c.priority,
              is_noise: c.is_noise, ai_summary: c.ai_summary,
              category: c.category, entities: c.entities,
            } : x)
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'conversations' },
        (payload) => {
          const id = (payload.old as any).id;
          setConversations((prev) => prev.filter((x) => x.id !== id));
          if (selectedId === id) setSelectedId(null);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedId]);

  // Realtime: messages (for selected conversation)
  useEffect(() => {
    if (!selectedId) return;
    const channel = supabase
      .channel(`rt-messages-${selectedId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedId}` },
        (payload) => {
          const m = payload.new as any;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, { ...m, attachments: [] }];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedId]);

  // Realtime: drafts (for drafts filter)
  useEffect(() => {
    if (filter !== "drafts") return;
    const channel = supabase
      .channel('rt-drafts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drafts' },
        () => {
          // Simple refetch for drafts
          if (!user) return;
          supabase
            .from("drafts")
            .select("*")
            .is("conversation_id", null)
            .eq("created_by", user.id)
            .order("updated_at", { ascending: false })
            .then(({ data: drafts }) => {
              setConversations(
                (drafts || []).map((d: any) => ({
                  id: `draft-${d.id}`, subject: d.subject || "(sans objet)",
                  snippet: d.body?.slice(0, 100) || null, from_email: d.from_email,
                  from_name: null, status: "open" as const, assigned_to: null,
                  is_read: true, last_message_at: d.updated_at, tags: [],
                  priority: null, is_noise: false, ai_summary: null,
                  category: null, entities: null,
                }))
              );
            });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filter, user]);

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

  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replyCancelledRef = useRef(false);

  useEffect(() => {
    return () => { if (replyTimerRef.current) clearTimeout(replyTimerRef.current); };
  }, []);

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

    replyCancelledRef.current = false;

    const toastId = toast("Réponse dans 15 secondes…", {
      duration: 15500,
      action: {
        label: "Annuler",
        onClick: () => {
          replyCancelledRef.current = true;
          if (replyTimerRef.current) {
            clearTimeout(replyTimerRef.current);
            replyTimerRef.current = null;
          }
          toast.dismiss(toastId);
          toast.info("Envoi annulé");
        },
      },
    });

    replyTimerRef.current = setTimeout(async () => {
      if (replyCancelledRef.current) return;
      toast.dismiss(toastId);

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
    }, 15000);
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

  const handleEditComment = async (commentId: string, newBody: string) => {
    const { error } = await supabase
      .from("comments")
      .update({ body: newBody })
      .eq("id", commentId);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success("Note modifiée");
    if (selectedId) fetchDetail(selectedId);
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success("Note supprimée");
    if (selectedId) fetchDetail(selectedId);
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

  const filteredConversations = conversations
    .filter((c) => !hideNoise || !c.is_noise)
    .filter((c) => !showUnreadOnly || !c.is_read);

  // Bulk action handlers
  const handleBulkToggle = useCallback((id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkSelectAll = useCallback(() => {
    setBulkSelected(new Set(filteredConversations.map((c) => c.id)));
  }, [filteredConversations]);

  const handleBulkDeselectAll = useCallback(() => {
    setBulkSelected(new Set());
  }, []);

  const handleBulkArchive = async () => {
    if (bulkSelected.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(bulkSelected);
    try {
      // Archive all selected in parallel
      await Promise.all(
        ids.map((id) =>
          supabase.functions.invoke("gmail-archive", { body: { conversation_id: id } })
        )
      );
      setConversations((prev) => prev.filter((c) => !bulkSelected.has(c.id)));
      if (selectedId && bulkSelected.has(selectedId)) setSelectedId(null);
      setBulkSelected(new Set());
      toast.success(`${ids.length} conversation(s) archivée(s)`);
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || String(err)));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkStatusChange = async (status: "open" | "snoozed" | "closed") => {
    if (bulkSelected.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(bulkSelected);
    try {
      const { error } = await supabase
        .from("conversations")
        .update({ status })
        .in("id", ids);
      if (error) throw error;
      setConversations((prev) =>
        prev.map((c) => (bulkSelected.has(c.id) ? { ...c, status } : c))
      );
      setBulkSelected(new Set());
      const labels = { open: "Ouvert", snoozed: "En pause", closed: "Fermé" };
      toast.success(`${ids.length} conversation(s) → ${labels[status]}`);
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || String(err)));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkMarkRead = async () => {
    if (bulkSelected.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(bulkSelected);
    try {
      const { error } = await supabase
        .from("conversations")
        .update({ is_read: true })
        .in("id", ids);
      if (error) throw error;
      setConversations((prev) =>
        prev.map((c) => (bulkSelected.has(c.id) ? { ...c, is_read: true } : c))
      );
      setBulkSelected(new Set());
      toast.success(`${ids.length} conversation(s) marquée(s) comme lue(s)`);
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || String(err)));
    } finally {
      setBulkLoading(false);
    }
  };

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
          <button
            onClick={() => setCommandOpen(true)}
            className="flex-1 max-w-xs flex items-center gap-2 h-8 px-3 rounded-lg bg-muted/50 border border-border/50 hover:border-border hover:bg-muted/80 transition-colors cursor-pointer text-sm text-muted-foreground"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Rechercher…</span>
            <kbd className="ml-auto pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground shrink-0">
              ⌘K
            </kbd>
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <NotificationBell onSelectConversation={(id) => { setSelectedId(id); }} />
            <span className="text-xs text-muted-foreground">
              {totalCount} conv.
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
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleBulkMarkRead} disabled={bulkLoading}>
                  <MailOpen className="h-3.5 w-3.5" /> Lu
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => handleBulkStatusChange("snoozed")} disabled={bulkLoading}>
                  <Clock className="h-3.5 w-3.5" /> En pause
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => handleBulkStatusChange("closed")} disabled={bulkLoading}>
                  <CheckCircle className="h-3.5 w-3.5" /> Fermer
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleBulkArchive} disabled={bulkLoading}>
                  <Trash2 className="h-3.5 w-3.5" /> Archiver
                </Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={handleBulkDeselectAll} disabled={bulkLoading}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
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
            showUnreadOnly={showUnreadOnly}
            onToggleUnreadOnly={() => setShowUnreadOnly(!showUnreadOnly)}
            unreadCount={conversations.filter((c) => !c.is_read).length}
            bulkSelected={bulkSelected}
            onBulkToggle={handleBulkToggle}
            onBulkSelectAll={handleBulkSelectAll}
            onBulkDeselectAll={handleBulkDeselectAll}
            responseTimes={responseTimes}
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
