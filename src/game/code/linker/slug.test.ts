import { describe, it, expect } from "vitest";
import { slug } from "./slug.js";

describe("slug", () => {
  it("lowercases and keeps a simple name", () => {
    expect(slug("Miner")).toBe("miner");
  });

  it("replaces runs of whitespace with single dash", () => {
    expect(slug("Mine Loop")).toBe("mine-loop");
    expect(slug("Mine   Loop")).toBe("mine-loop");
  });

  it("trims surrounding whitespace", () => {
    expect(slug("  Miner  ")).toBe("miner");
  });

  it("collapses tabs and newlines as whitespace", () => {
    expect(slug("a\tb\nc")).toBe("a-b-c");
  });
});
