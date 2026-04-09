import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type DraftData = {
  to_email?: string;
  from_email?: string;
  subject?: string;
  body?: string;
};

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

  // Load existing draft
  useEffect(() => {
    if (!user) return;
    // Only load if activeDraftId or conversationId is set
    if (!activeDraftId && !conversationId) {
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
        const d: DraftData = {
          to_email: data.to_email || undefined,
          from_email: data.from_email || undefined,
          subject: data.subject || undefined,
          body: data.body || undefined,
        };
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
    // Don't save if all fields are empty
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
            await supabase.from("drafts").delete().eq("id", inserted.id);
            return;
          }

          savedDraftIdRef.current = inserted.id;
          setSavedDraftId(inserted.id);
        }
      }
    } catch (err) {
      console.error("Draft save failed:", err);
    }
  }, [user, conversationId]);

  // Debounced auto-save
  const updateDraft = useCallback((data: DraftData) => {
    setDraft(data);
    latestDraft.current = data;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const generation = lifecycleRef.current;
      saveChainRef.current = saveChainRef.current
        .catch(() => undefined)
        .then(() => saveDraft(data, generation));
    }, 1500);
  }, [saveDraft]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const deleteDraft = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    lifecycleRef.current += 1;
    const currentDraftId = savedDraftIdRef.current;
    savedDraftIdRef.current = null;
    setSavedDraftId(null);

    if (currentDraftId) {
      await supabase.from("drafts").delete().eq("id", currentDraftId);
    }
    setDraft({});
    latestDraft.current = {};
  }, []);

  return { draft, updateDraft, deleteDraft, loading, savedDraftId, resetDraft };
}
