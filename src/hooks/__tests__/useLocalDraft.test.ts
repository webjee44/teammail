import { describe, it, expect, beforeEach } from "vitest";
import { saveLocal, loadLocal, clearLocal, listLocalDraftKeys } from "../useLocalDraft";

describe("useLocalDraft", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads a draft", () => {
    saveLocal("abc", { subject: "Hello", body: "World" });
    const loaded = loadLocal("abc");
    expect(loaded).toBeTruthy();
    expect(loaded!.subject).toBe("Hello");
    expect(loaded!.body).toBe("World");
    expect(loaded!.savedAt).toBeGreaterThan(0);
  });

  it("returns null for missing key", () => {
    expect(loadLocal("missing")).toBeNull();
  });

  it("clears a draft", () => {
    saveLocal("abc", { subject: "test" });
    clearLocal("abc");
    expect(loadLocal("abc")).toBeNull();
  });

  it("lists draft keys", () => {
    saveLocal("draft-1", { subject: "a" });
    saveLocal("draft-2", { subject: "b" });
    localStorage.setItem("other-key", "x");
    const keys = listLocalDraftKeys();
    expect(keys).toContain("draft-1");
    expect(keys).toContain("draft-2");
    expect(keys).not.toContain("other-key");
  });
});
