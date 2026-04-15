import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Conversation } from "@/components/inbox/ConversationList";

type SetConversations = React.Dispatch<React.SetStateAction<Conversation[]>>;
type SetMessages = React.Dispatch<React.SetStateAction<any[]>>;

interface UseConversationRealtimeParams {
  activeState: string;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  setConversations: SetConversations;
  setMessages: SetMessages;
  filter: string | null;
  userId: string | undefined;
}

export function useConversationRealtime({
  activeState,
  selectedId,
  setSelectedId,
  setConversations,
  setMessages,
  filter,
  userId,
}: UseConversationRealtimeParams) {
  const [freshlyUpdated, setFreshlyUpdated] = useState<Set<string>>(new Set());

  // Realtime: conversations
  useEffect(() => {
    const channel = supabase
      .channel('rt-conversations')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        (payload) => {
          const c = payload.new as any;
          if (c.state !== activeState) return;
          setConversations((prev) => {
            if (prev.some((x) => x.id === c.id)) return prev;
            return [{
              id: c.id, seq_number: c.seq_number, subject: c.subject, snippet: c.snippet,
              from_email: c.from_email, from_name: c.from_name,
              status: c.status, assigned_to: c.assigned_to,
              is_read: c.is_read, last_message_at: c.last_message_at,
              tags: [], priority: c.priority, is_noise: c.is_noise,
              ai_summary: c.ai_summary, category: c.category, entities: c.entities,
            }, ...prev];
          });
          markFreshlyUpdated(c.id);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          const c = payload.new as any;
          if (c.state !== activeState) {
            setConversations((prev) => prev.filter((x) => x.id !== c.id));
            if (selectedId === c.id) setSelectedId(null);
            return;
          }
          setConversations((prev) =>
            prev.map((x) => x.id === c.id ? {
              ...x, subject: c.subject, snippet: c.snippet, status: c.status,
              assigned_to: c.assigned_to, is_read: c.is_read,
              last_message_at: c.last_message_at, priority: c.priority,
              is_noise: c.is_noise, ai_summary: c.ai_summary,
              category: c.category, entities: c.entities,
            } : x)
            .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
          );
          markFreshlyUpdated(c.id);
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
  }, [selectedId, activeState, setConversations, setSelectedId]);

  // Realtime: messages for selected conversation
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
            if (prev.some((x: any) => x.id === m.id)) return prev;
            return [...prev, { ...m, attachments: [] }];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedId, setMessages]);

  // Realtime: drafts
  useEffect(() => {
    if (filter !== "drafts") return;
    const channel = supabase
      .channel('rt-drafts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drafts' },
        () => {
          if (!userId) return;
          supabase
            .from("drafts")
            .select("*")
            .is("conversation_id", null)
            .eq("created_by", userId)
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
  }, [filter, userId, setConversations]);

  function markFreshlyUpdated(id: string) {
    setFreshlyUpdated((prev) => new Set(prev).add(id));
    setTimeout(() => setFreshlyUpdated((prev) => { const next = new Set(prev); next.delete(id); return next; }), 3000);
  }

  return { freshlyUpdated };
}
