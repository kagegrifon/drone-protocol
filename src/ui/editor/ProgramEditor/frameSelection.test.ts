import { expect, test, describe } from "vitest";
import { resolveDisplayedFrame } from "./frameSelection.js";
import type { StackFrame } from "../../../game/code/linker/mapLine.js";

const frames: StackFrame[] = [
  { programId: "harvest", line: 5 },
  { programId: "moveTo", line: 2 },
];

describe("resolveDisplayedFrame", () => {
  test("follow (selectedIndex=null) → самый глубокий кадр", () => {
    expect(resolveDisplayedFrame({ frames, selectedIndex: null })).toEqual({
      programId: "moveTo",
      line: 2,
    });
  });

  test("заданный selectedIndex → этот кадр", () => {
    expect(resolveDisplayedFrame({ frames, selectedIndex: 0 })).toEqual({
      programId: "harvest",
      line: 5,
    });
  });

  test("пустой стек → null", () => {
    expect(resolveDisplayedFrame({ frames: [], selectedIndex: null })).toBeNull();
  });

  test("selectedIndex за пределами стека → fallback на follow (последний)", () => {
    expect(resolveDisplayedFrame({ frames, selectedIndex: 5 })).toEqual({
      programId: "moveTo",
      line: 2,
    });
  });
});
