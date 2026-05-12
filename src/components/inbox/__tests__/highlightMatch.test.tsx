import { describe, it, expect } from "vitest";
import { highlightMatch } from "../CommandMenu";

describe("highlightMatch", () => {
  it("returns text unchanged when query empty", () => {
    expect(highlightMatch("hello", "")).toEqual(["hello"]);
  });
  it("highlights case-insensitively", () => {
    const out = highlightMatch("Hello World", "hello");
    expect(out.length).toBeGreaterThan(1);
  });
  it("escapes regex special chars", () => {
    expect(() => highlightMatch("a.b+c", ".+")).not.toThrow();
  });
});
