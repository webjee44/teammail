import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { saveLocal, loadLocal, clearLocal } from "@/hooks/useLocalDraft";

type DraftData = {
  to_email?: string;
  from_email?: string;
  subject?: string;
  body?: string;
};

type DraftStatus = "draft" | "send_pending" | "sent" | "send_failed";

type UseDraftOptions = {
  conversationId?: string | null;
  draftId?: string | null;
};

export function useDraft({ conversationId = null, draftId = null }: UseDraftOptions = {}) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<DraftData>({});
  const [savedDraftId, setSavedDraftId] = useState<string | null>(draftId);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(draftId);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraft = useRef<DraftData>({});
  const savedDraftIdRef = useRef<string | null>(draftId);
  const lifecycleRef = useRef(0);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  // Local draft key
  const localKey = savedDraftIdRef.current || activeDraftId || "new";

  // Load existing draft
  useEffect(() => {
    if (!user) return;
    if (!activeDraftId && !conversationId) {
      // Check localStorage for recovery
      const local = loadLocal("new");
      if (local && (local.to_email || local.subject || local.body)) {
        const d: DraftData = {
          to_email: local.to_email,
          from_email: local.from_email,
          subject: local.subject,
          body: local.body,
        };
        setDraft(d);
        latestDraft.current = d;
      }
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      let query = supabase.from("drafts").select("*").eq("created_by", user.id);

      if (activeDraftId) {
        query = query.eq("id", activeDraftId);
      } else if (conversationId) {
        query = query.eq("conversation_id", conversationId);
      }

      const { data } = await query.maybeSingle();
      if (data) {
        // Check if localStorage has a more recent version
        const local = loadLocal(data.id);
        const useLocal = local?.savedAt && new Date(data.updated_at).getTime() < local.savedAt;

        const d: DraftData = useLocal
          ? { to_email: local!.to_email, from_email: local!.from_email, subject: local!.subject, body: local!.body }
          : { to_email: data.to_email || undefined, from_email: data.from_email || undefined, subject: data.subject || undefined, body: data.body || undefined };

        setDraft(d);
        latestDraft.current = d;
        setSavedDraftId(data.id);
        savedDraftIdRef.current = data.id;
      }
      setLoading(false);
    };
    load();
  }, [user, conversationId, activeDraftId]);

  const resetDraft = useCallback((newDraftId: string | null) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    lifecycleRef.current += 1;
    setDraft({});
    latestDraft.current = {};
    savedDraftIdRef.current = newDraftId;
    setSavedDraftId(newDraftId);
    setActiveDraftId(newDraftId);
    if (!newDraftId) {
      setLoading(false);
    }
  }, []);

  const saveDraft = useCallback(async (data: DraftData, generation: number) => {
    if (!user) return;
    const hasContent = data.to_email || data.subject || data.body;
    if (!hasContent) return;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile?.team_id || generation !== lifecycleRef.current) return;

      const record: any = {
        team_id: profile.team_id,
        created_by: user.id,
        to_email: data.to_email || null,
        from_email: data.from_email || null,
        subject: data.subject || null,
        body: data.body || null,
        conversation_id: conversationId || null,
      };

      const currentDraftId = savedDraftIdRef.current;

      if (currentDraftId) {
        await supabase.from("drafts").update(record).eq("id", currentDraftId);
      } else {
        const { data: inserted } = await supabase
          .from("drafts")
          .insert({ ...record, id: undefined })
          .select("id")
          .single();

        if (inserted?.id) {
          if (generation !== lifecycleRef.current) {
            // Draft was cancelled while insert was in-flight — mark as sent to clean up
            await supabase.from("drafts").update({ status: "sent" }).eq("id", inserted.id);
            return;
          }

          savedDraftIdRef.current = inserted.id;
          setSavedDraftId(inserted.id);
          // Migrate localStorage from "new" to actual id
          const local = loadLocal("new");
          if (local) {
            saveLocal(inserted.id, local);
            clearLocal("new");
          }
        }
      }
    } catch (err) {
      console.error("Draft save failed:", err);
    }
  }, [user, conversationId]);

  // Debounced auto-save (500ms)
  const updateDraft = useCallback((data: DraftData) => {
    setDraft(data);
    latestDraft.current = data;
    // Immediate localStorage save
    saveLocal(savedDraftIdRef.current || "new", data);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const generation = lifecycleRef.current;
      saveChainRef.current = saveChainRef.current
        .catch(() => undefined)
        .then(() => saveDraft(data, generation));
    }, 500);
  }, [saveDraft]);

  // Flush: cancel timer, force immediate server save
  const flushDraft = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const data = latestDraft.current;
    const generation = lifecycleRef.current;
    const p = saveChainRef.current
      .catch(() => undefined)
      .then(() => saveDraft(data, generation));
    saveChainRef.current = p;
    await p;
  }, [saveDraft]);

  // Set draft status in DB
  const setDraftStatus = useCallback(async (status: DraftStatus, errorMessage?: string) => {
    const id = savedDraftIdRef.current;
    if (!id) return;
    const update: any = { status };
    if (errorMessage !== undefined) update.error_message = errorMessage;
    if (status === "sent") update.error_message = null;
    await supabase.from("drafts").update(update).eq("id", id);
    if (status === "sent") {
      clearLocal(id);
      clearLocal("new");
    }
  }, []);

  // Legacy deleteDraft — now marks as sent
  const deleteDraft = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    lifecycleRef.current += 1;
    const currentDraftId = savedDraftIdRef.current;
    savedDraftIdRef.current = null;
    setSavedDraftId(null);

    if (currentDraftId) {
      await supabase.from("drafts").update({ status: "sent" }).eq("id", currentDraftId);
      clearLocal(currentDraftId);
    }
    clearLocal("new");
    setDraft({});
    latestDraft.current = {};
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // beforeunload — flush to localStorage (sync, always works)
  useEffect(() => {
    const handler = () => {
      const data = latestDraft.current;
      if (data.to_email || data.subject || data.body) {
        saveLocal(savedDraftIdRef.current || "new", data);
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // visibilitychange — flush to DB when tab goes hidden (more reliable than beforeunload on mobile)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden") {
        const data = latestDraft.current;
        if (data.to_email || data.subject || data.body) {
          // Save locally first (sync, guaranteed)
          saveLocal(savedDraftIdRef.current || "new", data);
          // Attempt DB flush (best-effort, may be killed by browser)
          const generation = lifecycleRef.current;
          saveChainRef.current = saveChainRef.current
            .catch(() => undefined)
            .then(() => saveDraft(data, generation));
        }
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [saveDraft]);

  return { draft, updateDraft, deleteDraft, flushDraft, setDraftStatus, loading, savedDraftId, resetDraft };
}
