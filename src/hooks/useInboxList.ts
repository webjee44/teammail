import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Conversation } from "@/components/inbox/ConversationList";

interface UseInboxListParams {
  filter: string | null;
  mailboxId: string | null;
  userId: string | undefined;
  activeState: string;
}

export function useInboxList({ filter, mailboxId, userId, activeState }: UseInboxListParams) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [responseTimes, setResponseTimes] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const refetchRef = useRef<() => void>(() => {});

  const refetch = useCallback(() => refetchRef.current(), []);

  useEffect(() => {
    const fetchConversations = async () => {
      setLoading(true);

      // ── Drafts ──
      if (filter === "drafts") {
        if (!userId) { setLoading(false); return; }
        const { data: drafts } = await supabase
          .from("drafts")
          .select("*")
          .is("conversation_id", null)
          .eq("created_by", userId)
          .in("status", ["draft", "send_failed"])
          .order("updated_at", { ascending: false });

        const draftEmails = new Set<string>();
        for (const d of drafts || []) {
          if (d.to_email) draftEmails.add(d.to_email.toLowerCase());
        }
        let draftContactMap = new Map<string, string>();
        if (draftEmails.size > 0) {
          const { data: contacts } = await supabase
            .from("contacts")
            .select("email, name")
            .in("email", Array.from(draftEmails));
          if (contacts) {
            draftContactMap = new Map(contacts.map((c: any) => [c.email.toLowerCase(), c.name]));
          }
        }

        setConversations(
          (drafts || []).map((d: any) => ({
            id: `draft-${d.id}`,
            subject: d.subject || "(sans objet)",
            snippet: d.body?.slice(0, 100) || null,
            from_email: d.from_email,
            from_name: null,
            to_email: d.to_email || null,
            to_name: d.to_email ? (draftContactMap.get(d.to_email.toLowerCase()) || null) : null,
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
            is_sent: true,
            draft_status: d.status,
          }))
        );
        setLoading(false);
        return;
      }

      // ── Sent ──
      if (filter === "sent") {
        const { data: sentConvs } = await supabase.rpc("get_sent_conversation_ids");
        const sentConvIds = (sentConvs || []).map((r: any) => r.conversation_id);
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

        if (mailboxId) convQuery = convQuery.eq("mailbox_id", mailboxId);

        const { data, error } = await convQuery;
        if (error) {
          console.error("Failed to fetch sent conversations:", error);
          toast.error("Erreur lors du chargement des conversations envoyées");
        } else {
          const ids = (data || []).map((c: any) => c.id);
          const { toEmailMap, toNameMap } = await resolveOutboundRecipients(ids);
          setConversations(
            (data || []).map((c: any) => ({
              id: c.id, seq_number: c.seq_number, subject: c.subject, snippet: c.snippet,
              from_email: c.from_email, from_name: c.from_name,
              to_email: toEmailMap.get(c.id) || null,
              to_name: toNameMap.get(c.id) || null,
              status: c.status as "open" | "closed",
              assigned_to: c.assigned_to, is_read: c.is_read,
              last_message_at: c.last_message_at, tags: [],
              priority: c.priority, is_noise: c.is_noise,
              ai_summary: c.ai_summary, category: c.category, entities: c.entities,
              is_sent: true,
            }))
          );
        }
        setLoading(false);
        return;
      }

      // ── Standard inbox / archived / closed etc. ──
      let query = supabase
        .from("conversations")
        .select("*")
        .eq("state", activeState as any)
        .order("last_message_at", { ascending: false });

      if (filter === "closed") {
        query = query.eq("status", "closed");
      } else if (filter === "mine") {
        query = query.eq("status", "open").eq("assigned_to", userId ?? "");
      } else if (filter === "unassigned") {
        query = query.eq("status", "open").is("assigned_to", null);
      } else if (filter !== "archived" && filter !== "trash" && filter !== "spam") {
        query = query.eq("status", "open");
      }

      if (mailboxId) query = query.eq("mailbox_id", mailboxId);

      const { data, error } = await query;

      if (error) {
        console.error("Failed to fetch conversations:", error);
        toast.error("Erreur lors du chargement des conversations");
      } else {
        const convIds = (data || []).map((c: any) => c.id);
        let draftConvIds = new Set<string>();
        if (convIds.length > 0 && userId) {
          const { data: draftData } = await supabase
            .from("drafts")
            .select("conversation_id")
            .in("conversation_id", convIds)
            .eq("created_by", userId);
          if (draftData) {
            draftConvIds = new Set(draftData.map((d: any) => d.conversation_id).filter(Boolean));
          }
        }

        let mailboxEmails = new Set<string>();
        const { data: mailboxes } = await supabase.from("team_mailboxes").select("email");
        if (mailboxes) {
          mailboxEmails = new Set(mailboxes.map((m: any) => m.email.toLowerCase()));
        }

        const isInboxView = !filter || filter === "mine" || filter === "unassigned";
        const filteredData = isInboxView
          ? (data || []).filter((c: any) => !c.from_email || !mailboxEmails.has(c.from_email.toLowerCase()))
          : (data || []);

        const outboundConvIds = filteredData
          .filter((c: any) => c.from_email && mailboxEmails.has(c.from_email.toLowerCase()))
          .map((c: any) => c.id);

        const { toEmailMap, toNameMap } = outboundConvIds.length > 0
          ? await resolveOutboundRecipients(outboundConvIds)
          : { toEmailMap: new Map<string, string>(), toNameMap: new Map<string, string>() };

        setConversations(
          filteredData.map((c: any) => {
            const isSent = c.from_email && mailboxEmails.has(c.from_email.toLowerCase());
            return {
              id: c.id, seq_number: c.seq_number, subject: c.subject, snippet: c.snippet,
              from_email: c.from_email, from_name: c.from_name,
              to_email: isSent ? (toEmailMap.get(c.id) || null) : undefined,
              to_name: isSent ? (toNameMap.get(c.id) || null) : undefined,
              status: c.status as "open" | "closed",
              assigned_to: c.assigned_to, is_read: c.is_read,
              last_message_at: c.last_message_at, tags: [],
              priority: c.priority, is_noise: c.is_noise,
              ai_summary: c.ai_summary, category: c.category, entities: c.entities,
              has_draft: draftConvIds.has(c.id),
              is_sent: isSent || false,
            };
          })
        );

        // Response times
        if (convIds.length > 0) {
          const { data: allMsgs } = await supabase
            .from("messages")
            .select("conversation_id, is_outbound, sent_at")
            .in("conversation_id", convIds)
            .order("sent_at", { ascending: true });
          if (allMsgs) {
            const rtMap = new Map<string, number>();
            const needsReplySet = new Set<string>();
            const byConvo = new Map<string, typeof allMsgs>();
            for (const m of allMsgs) {
              const list = byConvo.get(m.conversation_id) || [];
              list.push(m);
              byConvo.set(m.conversation_id, list);
            }
            for (const [cid, msgs] of byConvo) {
              if (msgs.length > 0 && !msgs[msgs.length - 1].is_outbound) {
                needsReplySet.add(cid);
              }
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
            setConversations(prev => prev.map(c => ({
              ...c,
              needs_reply: needsReplySet.has(c.id),
            })));
          }
        }
      }
      setLoading(false);
    };

    refetchRef.current = fetchConversations;
    fetchConversations();
  }, [filter, mailboxId, userId, activeState]);

  return { conversations, setConversations, responseTimes, loading, refetch };
}

// ─── Helper: resolve outbound recipients ──────────────────────────

async function resolveOutboundRecipients(convIds: string[]) {
  const toEmailMap = new Map<string, string>();
  const toNameMap = new Map<string, string>();
  const BATCH = 50;
  const allMsgs: { conversation_id: string; to_email: string | null }[] = [];

  for (let i = 0; i < convIds.length; i += BATCH) {
    const batch = convIds.slice(i, i + BATCH);
    const { data: batchMsgs } = await supabase
      .from("messages")
      .select("conversation_id, to_email")
      .in("conversation_id", batch)
      .eq("is_outbound", true)
      .order("sent_at", { ascending: true })
      .limit(500);
    if (batchMsgs) allMsgs.push(...batchMsgs);
  }

  const rawEmails = new Set<string>();
  for (const m of allMsgs) {
    if (m.to_email && !toEmailMap.has(m.conversation_id)) {
      const match = m.to_email.match(/^(.+?)\s*<(.+?)>$/);
      const email = match ? match[2] : m.to_email;
      const parsedName = match ? match[1].trim() : null;
      toEmailMap.set(m.conversation_id, email);
      if (parsedName) toNameMap.set(m.conversation_id, parsedName);
      rawEmails.add(email.toLowerCase());
    }
  }

  if (rawEmails.size > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("email, name")
      .in("email", Array.from(rawEmails));
    if (contacts) {
      const contactMap = new Map(contacts.map((c: any) => [c.email.toLowerCase(), c.name]));
      for (const [convId, email] of toEmailMap) {
        if (!toNameMap.has(convId)) {
          const contactName = contactMap.get(email.toLowerCase());
          if (contactName) toNameMap.set(convId, contactName);
        }
      }
    }
  }

  return { toEmailMap, toNameMap };
}
