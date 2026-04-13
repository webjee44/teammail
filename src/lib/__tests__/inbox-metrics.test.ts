import { describe, it, expect } from "vitest";
import {
  isActionable,
  isReplied,
  isNoise,
  isUnread,
  isReadActionable,
  computeInboxCounts,
  type InboxConversation,
} from "../inbox-metrics";

const make = (overrides: Partial<InboxConversation> = {}): InboxConversation => ({
  id: "1",
  status: "open",
  is_noise: false,
  is_read: false,
  needs_reply: true,
  assigned_to: null,
  ...overrides,
});

describe("inbox-metrics predicates", () => {
  it("unread actionable conversation", () => {
    const c = make();
    expect(isActionable(c)).toBe(true);
    expect(isUnread(c)).toBe(true);
    expect(isReplied(c)).toBe(false);
    expect(isNoise(c)).toBe(false);
  });

  it("read actionable conversation", () => {
    const c = make({ is_read: true });
    expect(isActionable(c)).toBe(true);
    expect(isReadActionable(c)).toBe(true);
    expect(isUnread(c)).toBe(false);
  });

  it("replied conversation", () => {
    const c = make({ needs_reply: false });
    expect(isActionable(c)).toBe(false);
    expect(isReplied(c)).toBe(true);
  });

  it("noise conversation", () => {
    const c = make({ is_noise: true });
    expect(isActionable(c)).toBe(false);
    expect(isNoise(c)).toBe(true);
    expect(isReplied(c)).toBe(false);
  });

  it("closed conversation is not actionable", () => {
    const c = make({ status: "closed" });
    expect(isActionable(c)).toBe(false);
    expect(isReplied(c)).toBe(false);
  });
});

describe("computeInboxCounts", () => {
  it("counts are mutually exclusive and additive", () => {
    const convs = [
      make({ id: "1" }),                          // actionable unread
      make({ id: "2", is_read: true }),            // actionable read
      make({ id: "3", needs_reply: false }),        // replied
      make({ id: "4", is_noise: true }),           // noise
      make({ id: "5", status: "closed" }),         // closed (not counted)
    ];

    const counts = computeInboxCounts(convs);

    expect(counts.actionable).toBe(2);
    expect(counts.unread).toBe(1);
    expect(counts.readActionable).toBe(1);
    expect(counts.replied).toBe(1);
    expect(counts.noise).toBe(1);

    // actionable = unread + readActionable
    expect(counts.actionable).toBe(counts.unread + counts.readActionable);
  });

  it("empty list returns zeroes", () => {
    const counts = computeInboxCounts([]);
    expect(counts.actionable).toBe(0);
    expect(counts.noise).toBe(0);
  });

  it("needs_reply undefined treated as actionable", () => {
    const c = make({ needs_reply: undefined });
    const counts = computeInboxCounts([c]);
    expect(counts.actionable).toBe(1);
  });
});
