import { describe, it, expect } from "vitest";
import { mapLine, mapStackToEntryLine } from "./mapLine.js";
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

// Склеенный код: строки 1-5 — модуль "mod", строки 6-10 — entry "e"
const lineMapWithMod: LineMapSegment[] = [
  { fromLine: 1, toLine: 5, programId: "mod", origLine: 1 },
  { fromLine: 6, toLine: 10, programId: "e", origLine: 1 },
];

describe("mapStackToEntryLine", () => {
  it("стек только из entry-строк → возвращает строку entry", () => {
    // glued line 7 → entry origLine 1 + (7-6) = 2
    expect(mapStackToEntryLine({ lineStack: [7], lineMap: lineMapWithMod, entryId: "e" })).toBe(2);
  });

  it("стек [entry-строка вызова, mod-строка] → подсвечивается entry-строка вызова", () => {
    // lineStack[0] = 8 (строка вызова goToBase() в entry, origLine 3)
    // lineStack[1] = 3 (строка moveTo() внутри mod — в entry не маппится)
    // Результат: 3 (entry origLine)
    expect(mapStackToEntryLine({ lineStack: [8, 3], lineMap: lineMapWithMod, entryId: "e" })).toBe(3);
  });

  it("тройной стек entry→modA→modB → подсвечивается строка вызова modA из entry", () => {
    // lineStack = [entry-вызов-modA (8), modA-вызов-modB (2), modB-текущее (1)]
    // 8 → entry origLine 3; 2 → mod → null; 1 → mod → null
    // Самая глубокая entry-строка = 3
    expect(mapStackToEntryLine({ lineStack: [8, 2, 1], lineMap: lineMapWithMod, entryId: "e" })).toBe(3);
  });

  it("стек целиком внутри модулей (нет entry-кадра) → null", () => {
    // lineStack[0] = 2, lineStack[1] = 4 — оба в mod
    expect(mapStackToEntryLine({ lineStack: [2, 4], lineMap: lineMapWithMod, entryId: "e" })).toBeNull();
  });

  it("пустой стек → null", () => {
    expect(mapStackToEntryLine({ lineStack: [], lineMap: lineMapWithMod, entryId: "e" })).toBeNull();
  });
});
