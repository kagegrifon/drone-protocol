import { describe, it, expect } from "vitest";
import { mapLine } from "./mapLine.js";
import type { LineMapSegment } from "./linkProgram.js";

// Склеенный код: строки 1-3 — модуль "m", строки 4-6 — entry "e".
const lineMap: LineMapSegment[] = [
  { fromLine: 1, toLine: 3, programId: "m", origLine: 1 },
  { fromLine: 4, toLine: 6, programId: "e", origLine: 1 },
];

describe("mapLine", () => {
  it("maps a glued line inside the entry segment to its original line", () => {
    // glued line 5 → entry, origLine 1 + (5-4) = 2
    expect(mapLine(5, lineMap, "e")).toEqual({ programId: "e", origLine: 2 });
  });

  it("maps the first line of a segment to its origLine", () => {
    expect(mapLine(4, lineMap, "e")).toEqual({ programId: "e", origLine: 1 });
  });

  it("returns null for a line inside a module segment (v1: highlight off)", () => {
    // line 2 belongs to module "m", not the entry — highlight gutters off
    expect(mapLine(2, lineMap, "e")).toBeNull();
  });

  it("returns null when line is out of range", () => {
    expect(mapLine(99, lineMap, "e")).toBeNull();
  });
});
