import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Conversation } from "@/components/inbox/ConversationList";
import type { FileToUpload } from "@/components/inbox/Attachments";

type SetConversations = React.Dispatch<React.SetStateAction<Conversation[]>>;

interface UseInboxMutationsParams {
  conversations: Conversation[];
  setConversations: SetConversations;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  searchResults: Conversation[] | null;
  mailboxId: string | null;
  user: any;
  messages: any[];
  fetchDetail: (id: string) => void;
  refetch: () => void;
}

/**
 * Centralized inbox mutations with 2 internal helpers:
 * - applyConversationPatch: update fields on a conversation in the local list
 * - removeFromActiveView: remove a conversation from the displayed list
 */
export function useInboxMutations({
  conversations,
  setConversations,
  selectedId,
  setSelectedId,
  searchResults,
  mailboxId,
  user,
  messages,
  fetchDetail,
  refetch,
}: UseInboxMutationsParams) {
  const [bulkLoading, setBulkLoading] = useState(false);

  // ─── Internal helpers ───────────────────────────────────────────

  const applyConversationPatch = useCallback(
    (id: string, patch: Partial<Conversation>) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
      );
    },
    [setConversations]
  );

  const removeFromActiveView = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [setConversations, selectedId, setSelectedId]
  );

  // ─── Archive (soft) ─────────────────────────────────────────────

  const handleArchive = useCallback(
    async (id: string) => {
      // Optimistic removal from inbox view
      removeFromActiveView(id);
      try {
        const { data, error } = await supabase.functions.invoke("gmail-archive", {
          body: { conversation_id: id },
        });
        if (error || data?.error) {
          toast.error("Erreur : " + (data?.error || error?.message));
          refetch(); // rollback by refetching
          return;
        }
        toast.success("Conversation archivée");
      } catch (err: any) {
        toast.error("Erreur : " + (err.message || String(err)));
        refetch();
      }
    },
    [removeFromActiveView, refetch]
  );

  // ─── Trash (soft) ──────────────────────────────────────────────

  const handleTrash = useCallback(
    async (id: string) => {
      removeFromActiveView(id);
      const { error } = await supabase
        .from("conversations")
        .update({ state: "trash" as any })
        .eq("id", id);
      if (error) {
        toast.error("Erreur : " + error.message);
        refetch();
        return;
      }
      toast.success("Conversation mise à la corbeille");
    },
    [removeFromActiveView, refetch]
  );

  // ─── Spam ──────────────────────────────────────────────────────

  const handleSpam = useCallback(
    async (id: string) => {
      removeFromActiveView(id);
      const { error } = await supabase
        .from("conversations")
        .update({ state: "spam" as any })
        .eq("id", id);
      if (error) {
        toast.error("Erreur : " + error.message);
        refetch();
        return;
      }
      toast.success("Conversation marquée comme spam");
    },
    [removeFromActiveView, refetch]
  );

  // ─── Status change ──────────────────────────────────────────────

  const handleStatusChange = useCallback(
    async (id: string, status: "open" | "closed") => {
      applyConversationPatch(id, { status });
      const { error } = await supabase
        .from("conversations")
        .update({ status })
        .eq("id", id);
      if (error) {
        toast.error("Erreur : " + error.message);
        refetch();
        return;
      }
      toast.success(`Statut → ${status === "open" ? "Ouvert" : "Fermé"}`);
    },
    [applyConversationPatch, refetch]
  );

  // ─── Reply (strict mailbox routing) ─────────────────────────────

  const handleReply = useCallback(
    async (id: string, body: string, attachedFiles?: FileToUpload[]) => {
      const conv =
        conversations.find((c) => c.id === id) ??
        searchResults?.find((c) => c.id === id);
      if (!conv?.from_email) return;

      // 1. Mailbox of the conversation
      const { data: convRow } = await supabase
        .from("conversations")
        .select("mailbox_id, gmail_thread_id")
        .eq("id", id)
        .maybeSingle();

      let fromEmail: string | undefined;

      if (convRow?.mailbox_id) {
        const { data: mb } = await supabase
          .from("team_mailboxes")
          .select("email")
          .eq("id", convRow.mailbox_id)
          .single();
        fromEmail = mb?.email;
      }

      // 2. Fallback: current mailbox from URL
      if (!fromEmail && mailboxId) {
        const { data: mb } = await supabase
          .from("team_mailboxes")
          .select("email")
          .eq("id", mailboxId)
          .single();
        fromEmail = mb?.email;
      }

      // 3. No automatic fallback — block
      if (!fromEmail) {
        toast.error(
          "Impossible de déterminer l'expéditeur. Sélectionnez une boîte mail."
        );
        return;
      }

      const lastMsg =
        messages.length > 0 ? messages[messages.length - 1] : null;
      const senderName = user?.user_metadata?.full_name || "";
      const gmailAttachments = attachedFiles?.map((f) => ({
        filename: f.name,
        mime_type: f.file.type || "application/octet-stream",
        data: f.base64,
      }));

      // Insert directly into outbox_commands
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) throw new Error("Non authentifié");
        const { data: profile } = await supabase
          .from("profiles")
          .select("team_id")
          .eq("user_id", currentUser.id)
          .maybeSingle();
        if (!profile?.team_id) throw new Error("Aucune équipe");

        const { error: insertErr } = await supabase.from("outbox_commands").insert({
          team_id: profile.team_id,
          created_by: currentUser.id,
          command_type: "send_reply",
          conversation_id: id,
          idempotency_key: `reply-${id}-${Date.now()}`,
          payload: {
            to: conv.from_email,
            subject: `Re: ${conv.subject}`,
            body,
            from_email: fromEmail,
            from_name: senderName || fromEmail,
            attachments: gmailAttachments?.length ? gmailAttachments : undefined,
            thread_id: convRow?.gmail_thread_id || undefined,
            in_reply_to: (lastMsg as any)?.gmail_message_id || undefined,
            references: (lastMsg as any)?.gmail_message_id || undefined,
            conversation_id: id,
            attached_files: attachedFiles?.map((f: FileToUpload) => ({
              name: f.name,
              type: f.file.type,
              size: f.file.size,
              base64: f.base64,
            })) || undefined,
          },
        });
        if (insertErr) throw insertErr;

        toast.success("Réponse en cours d'envoi…");
        fetchDetail(id);
        refetch();
      } catch (err: any) {
        toast.error("Erreur d'envoi : " + (err.message || String(err)));
      }
    },
    [conversations, searchResults, mailboxId, user, messages, fetchDetail, refetch]
  );

  // ─── Bulk actions ───────────────────────────────────────────────

  const handleBulkArchive = useCallback(
    async (bulkSelected: Set<string>, clearBulk: () => void) => {
      if (bulkSelected.size === 0) return;
      setBulkLoading(true);
      const ids = Array.from(bulkSelected);
      try {
        await Promise.all(
          ids.map((id) =>
            supabase.functions.invoke("gmail-archive", {
              body: { conversation_id: id },
            })
          )
        );
        // Remove from active view
        setConversations((prev) =>
          prev.filter((c) => !bulkSelected.has(c.id))
        );
        if (selectedId && bulkSelected.has(selectedId)) setSelectedId(null);
        clearBulk();
        toast.success(`${ids.length} conversation(s) archivée(s)`);
      } catch (err: any) {
        toast.error("Erreur : " + (err.message || String(err)));
      } finally {
        setBulkLoading(false);
      }
    },
    [setConversations, selectedId, setSelectedId]
  );

  const handleBulkStatusChange = useCallback(
    async (
      bulkSelected: Set<string>,
      status: "open" | "closed",
      clearBulk: () => void
    ) => {
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
        clearBulk();
        const labels = { open: "Ouvert", closed: "Fermé" } as Record<
          string,
          string
        >;
        toast.success(`${ids.length} conversation(s) → ${labels[status]}`);
      } catch (err: any) {
        toast.error("Erreur : " + (err.message || String(err)));
      } finally {
        setBulkLoading(false);
      }
    },
    [setConversations]
  );

  const handleBulkMarkRead = useCallback(
    async (bulkSelected: Set<string>, clearBulk: () => void) => {
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
          prev.map((c) =>
            bulkSelected.has(c.id) ? { ...c, is_read: true } : c
          )
        );
        clearBulk();
        toast.success(
          `${ids.length} conversation(s) marquée(s) comme lue(s)`
        );
      } catch (err: any) {
        toast.error("Erreur : " + (err.message || String(err)));
      } finally {
        setBulkLoading(false);
      }
    },
    [setConversations]
  );

  return {
    handleArchive,
    handleTrash,
    handleSpam,
    handleStatusChange,
    handleReply,
    handleBulkArchive,
    handleBulkStatusChange,
    handleBulkMarkRead,
    bulkLoading,
  };
}
