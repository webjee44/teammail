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
      }
      setLoading(false);
    };
    load();
  }, [user, conversationId, activeDraftId]);

  const resetDraft = useCallback((newDraftId: string | null) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDraft({});
    latestDraft.current = {};
    setSavedDraftId(newDraftId);
    setActiveDraftId(newDraftId);
    if (!newDraftId) {
      setLoading(false);
    }
  }, []);

  const saveDraft = useCallback(async (data: DraftData) => {
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
      if (!profile?.team_id) return;

      const record: any = {
        team_id: profile.team_id,
        created_by: user.id,
        to_email: data.to_email || null,
        from_email: data.from_email || null,
        subject: data.subject || null,
        body: data.body || null,
        conversation_id: conversationId || null,
      };

      if (savedDraftId) {
        await supabase.from("drafts").update(record).eq("id", savedDraftId);
      } else {
        const { data: inserted } = await supabase
          .from("drafts")
          .insert({ ...record, id: undefined })
          .select("id")
          .single();
        if (inserted) setSavedDraftId(inserted.id);
      }
    } catch (err) {
      console.error("Draft save failed:", err);
    }
  }, [user, conversationId, savedDraftId]);

  // Debounced auto-save
  const updateDraft = useCallback((data: DraftData) => {
    setDraft(data);
    latestDraft.current = data;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveDraft(data);
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
    if (savedDraftId) {
      await supabase.from("drafts").delete().eq("id", savedDraftId);
      setSavedDraftId(null);
    }
  }, [savedDraftId]);

  return { draft, updateDraft, deleteDraft, loading, savedDraftId };
}
