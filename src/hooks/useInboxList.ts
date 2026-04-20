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
        let sentQuery = supabase
          .from("conversations")
          .select(`
            id,
            seq_number,
            subject,
            snippet,
            from_email,
            from_name,
            status,
            assigned_to,
            is_read,
            last_message_at,
            priority,
            is_noise,
            ai_summary,
            category,
            entities,
            messages!inner(id)
          `)
          .eq("messages.is_outbound", true)
          .order("last_message_at", { ascending: false })
          .limit(200);

        if (mailboxId) sentQuery = sentQuery.eq("mailbox_id", mailboxId);

        const { data, error } = await sentQuery;
        if (error) {
          console.error("Failed to fetch sent conversations:", error);
          toast.error("Erreur lors du chargement des conversations envoyées");
        } else {
          const rows = Array.from(new Map((data || []).map((c: any) => [c.id, c])).values());
          const ids = rows.map((c: any) => c.id);
          const { toEmailMap, toNameMap } = await resolveOutboundRecipients(ids);
          setConversations(
            rows.map((c: any) => ({
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

      // ── Standard inbox views: use inbox_list RPC ──
      const isStandardInbox = !filter || filter === "mine" || filter === "unassigned";
      const isSpecialState = filter && ["archived", "trash", "spam", "closed"].includes(filter);

      if (isStandardInbox || isSpecialState) {
        const rpcParams: Record<string, any> = {
          p_limit: 200,
          p_offset: 0,
        };

        if (isSpecialState) {
          if (filter === "closed") {
            rpcParams.p_state = "inbox";
            rpcParams.p_status = "closed";
          } else {
            rpcParams.p_state = filter;
          }
        } else {
          rpcParams.p_state = "inbox";
          if (filter === "mine" && userId) {
            rpcParams.p_status = "open";
          } else if (filter === "unassigned") {
            rpcParams.p_status = "open";
          } else {
            rpcParams.p_status = "open";
          }
        }

        if (mailboxId) rpcParams.p_mailbox_id = mailboxId;

        const { data, error } = await supabase.rpc("inbox_list", rpcParams);

        if (error) {
          console.error("Failed to fetch inbox:", error);
          toast.error("Erreur lors du chargement des conversations");
        } else {
          let rows = data || [];

          // Apply client-side filters the RPC doesn't handle
          if (filter === "mine" && userId) {
            rows = rows.filter((r: any) => r.assigned_to === userId);
          } else if (filter === "unassigned") {
            rows = rows.filter((r: any) => !r.assigned_to);
          }

          setConversations(
            rows.map((r: any) => ({
              id: r.id,
              seq_number: r.seq_number,
              subject: r.subject,
              snippet: r.snippet,
              from_email: r.from_email,
              from_name: r.from_name,
              status: r.status as "open" | "closed",
              state: r.state,
              assigned_to: r.assigned_to,
              assignee_name: r.assignee_name,
              is_read: r.is_read,
              last_message_at: r.last_message_at,
              tags: (r.tag_ids || []).map((id: string, i: number) => ({
                id,
                name: (r.tag_names || [])[i] || "",
                color: (r.tag_colors || [])[i] || "#6366f1",
              })),
              priority: r.priority,
              is_noise: r.is_noise,
              ai_summary: r.ai_summary,
              category: r.category,
              has_draft: r.has_draft,
              needs_reply: r.needs_reply,
            }))
          );
        }
        setLoading(false);
        return;
      }

      // Fallback (shouldn't hit)
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
