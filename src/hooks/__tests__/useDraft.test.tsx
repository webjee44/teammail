import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDraft } from "../useDraft";

const profileMaybeSingle = vi.fn();
const draftMaybeSingle = vi.fn();
const single = vi.fn();
const insert = vi.fn();
const updateEq = vi.fn();
const update = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/useLocalDraft", () => ({
  saveLocal: vi.fn(),
  loadLocal: vi.fn().mockReturnValue(null),
  clearLocal: vi.fn(),
  listLocalDraftKeys: vi.fn().mockReturnValue([]),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: profileMaybeSingle,
            }),
          }),
        };
      }

      if (table === "drafts") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: draftMaybeSingle,
            }),
          }),
          insert,
          update,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

describe("useDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    profileMaybeSingle.mockResolvedValue({ data: { team_id: "team-1" } });
    draftMaybeSingle.mockResolvedValue({ data: null });
    insert.mockReturnValue({
      select: () => ({
        single,
      }),
    });
    update.mockReturnValue({
      eq: updateEq,
    });
    updateEq.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marque un draft comme 'sent' au lieu de le supprimer après envoi", async () => {
    let resolveInsert: ((value: { data: { id: string } }) => void) | undefined;
    single.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInsert = resolve;
        })
    );

    const { result } = renderHook(() => useDraft());

    await act(async () => {
      result.current.updateDraft({ subject: "Bonjour" });
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(insert).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveInsert?.({ data: { id: "draft-1" } });
      await Promise.resolve();
      await Promise.resolve();
    });

    // Now deleteDraft should mark as 'sent', not delete
    await act(async () => {
      await result.current.deleteDraft();
    });

    expect(update).toHaveBeenCalled();
    expect(updateEq).toHaveBeenCalledWith("id", "draft-1");
  });

  it("sérialise les sauvegardes pour éviter les doublons de draft", async () => {
    let resolveFirstInsert: ((value: { data: { id: string } }) => void) | undefined;
    single.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstInsert = resolve;
        })
    );

    const { result } = renderHook(() => useDraft());

    await act(async () => {
      result.current.updateDraft({ subject: "Version 1" });
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(insert).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.updateDraft({ subject: "Version 2" });
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(insert).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstInsert?.({ data: { id: "draft-2" } });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(updateEq).toHaveBeenCalledWith("id", "draft-2");
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("flushDraft force un save immédiat", async () => {
    single.mockResolvedValue({ data: { id: "draft-3" } });

    const { result } = renderHook(() => useDraft());

    await act(async () => {
      result.current.updateDraft({ subject: "Flush test" });
      // Don't wait for debounce — flush immediately
      await result.current.flushDraft();
    });

    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("setDraftStatus met à jour le status en base", async () => {
    single.mockResolvedValue({ data: { id: "draft-4" } });

    const { result } = renderHook(() => useDraft());

    // Create a draft first
    await act(async () => {
      result.current.updateDraft({ subject: "Status test" });
      await vi.advanceTimersByTimeAsync(600);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.setDraftStatus("send_pending");
    });

    expect(update).toHaveBeenCalled();
  });
});
