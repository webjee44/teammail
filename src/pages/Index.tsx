import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConversationList, Conversation } from "@/components/inbox/ConversationList";
import { ConversationDetail } from "@/components/inbox/ConversationDetail";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";

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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [hideNoise, setHideNoise] = useState(false);
  const [searchParams] = useSearchParams();
  const filter = searchParams.get("filter");
  const mailboxId = searchParams.get("mailbox");
  const { user } = useAuth();

  // Fetch conversations based on filter
  useEffect(() => {
    const fetchConversations = async () => {
      setLoading(true);
      let query = supabase
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false });

      // Apply filter
      if (filter === "snoozed") {
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
  }, [filter, user?.id]);

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

    if (msgRes.data) setMessages(msgRes.data);
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

  const handleReply = async (id: string, body: string) => {
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

    const { data, error } = await supabase.functions.invoke("gmail-send", {
      body: {
        to: conv.from_email,
        subject: `Re: ${conv.subject}`,
        body,
        from_email: fromEmail,
      },
    });

    if (error || data?.error) {
      toast.error("Erreur d'envoi : " + (data?.error || error?.message));
      return;
    }

    await supabase.from("messages").insert({
      conversation_id: id,
      from_email: fromEmail,
      from_name: user?.user_metadata?.full_name || fromEmail,
      to_email: conv.from_email,
      body_text: body,
      body_html: body.replace(/\n/g, "<br>"),
      is_outbound: true,
      gmail_message_id: data?.messageId || null,
    });

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
  };
  const headerTitle = filter ? filterLabels[filter] || "Boîte de réception" : "Boîte de réception";

  return (
    <AppLayout hideHeader>
      <div className="flex w-full h-screen">
        <div className="w-[340px] border-r border-border flex flex-col shrink-0">
          <div className="h-12 flex items-center px-3 border-b border-border gap-2 shrink-0">
            <SidebarTrigger />
            <h2 className="text-sm font-semibold text-foreground">{headerTitle}</h2>
            <span className="text-xs text-muted-foreground ml-auto">
              {totalCount} conversation{totalCount !== 1 ? "s" : ""}
            </span>
          </div>
          <ConversationList
            conversations={filteredConversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={loading}
            hideNoise={hideNoise}
            onToggleNoise={() => setHideNoise(!hideNoise)}
            noiseCount={noiseCount}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <ConversationDetail
            conversation={selectedDetail}
            onStatusChange={handleStatusChange}
            onReply={handleReply}
            onComment={handleComment}
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
