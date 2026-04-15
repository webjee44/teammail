import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Message = {
  id: string;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  cc?: string | null;
  body_html: string | null;
  body_text: string | null;
  sent_at: string;
  is_outbound: boolean;
  attachments?: any[];
};

type Comment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name?: string;
};

export function useConversationDetail(selectedId: string | null, userId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  // Mark as read when selected
  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId);
      supabase
        .from("conversations")
        .update({ is_read: true })
        .eq("id", selectedId)
        .then();
      supabase.functions.invoke("gmail-mark-read", {
        body: { conversation_id: selectedId },
      }).catch((err) => console.error("Gmail mark-read failed:", err));
    }
  }, [selectedId, fetchDetail]);

  const handleComment = useCallback(async (id: string, body: string) => {
    if (!userId) return;
    const { error } = await supabase.from("comments").insert({
      conversation_id: id,
      user_id: userId,
      body,
    });
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success("Note ajoutée");
    fetchDetail(id);
  }, [userId, fetchDetail]);

  const handleEditComment = useCallback(async (commentId: string, newBody: string) => {
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
  }, [selectedId, fetchDetail]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
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
  }, [selectedId, fetchDetail]);

  return {
    messages, setMessages,
    comments,
    loadingDetail,
    fetchDetail,
    handleComment,
    handleEditComment,
    handleDeleteComment,
  };
}
