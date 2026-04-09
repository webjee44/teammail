import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDraft } from "../useDraft";

const profileMaybeSingle = vi.fn();
const draftMaybeSingle = vi.fn();
const single = vi.fn();
const insert = vi.fn();
const updateEq = vi.fn();
const update = vi.fn();
const deleteEq = vi.fn();
const removeDraft = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
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
          delete: removeDraft,
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
    removeDraft.mockReturnValue({
      eq: deleteEq,
    });
    deleteEq.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("supprime un draft recréé par une sauvegarde en vol après envoi", async () => {
    let resolveInsert: ((value: { data: { id: string } }) => void) | undefined;
    single.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInsert = resolve;
        })
    );

    const { result } = renderHook(() => useDraft());

    act(() => {
      result.current.updateDraft({ subject: "Bonjour" });
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.deleteDraft();
    });

    await act(async () => {
      resolveInsert?.({ data: { id: "draft-1" } });
      await Promise.resolve();
    });

    await waitFor(() => expect(deleteEq).toHaveBeenCalledWith("id", "draft-1"));
    expect(result.current.savedDraftId).toBeNull();
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

    act(() => {
      result.current.updateDraft({ subject: "Version 1" });
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.updateDraft({ subject: "Version 2" });
      vi.advanceTimersByTime(1500);
    });

    expect(insert).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstInsert?.({ data: { id: "draft-2" } });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(updateEq).toHaveBeenCalledWith("id", "draft-2"));
    expect(insert).toHaveBeenCalledTimes(1);
  });
});