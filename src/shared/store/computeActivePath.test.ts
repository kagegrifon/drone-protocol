import { describe, it, expect } from "vitest";
import { computeActivePath } from "./computeActivePath.js";
import type { CallFrame } from "../../game/simulation/components/Program.js";

describe("computeActivePath", () => {
  it("returns null for empty callStack", () => {
    expect(computeActivePath([], "idle")).toBeNull();
  });

  it("returns [0] for single frame at index 0 while running", () => {
    const stack: CallFrame[] = [{ programId: "p1", instructionIndex: 0 }];
    expect(computeActivePath(stack, "running")).toEqual([0]);
  });

  it("returns [2] for single frame at index 2 while running", () => {
    const stack: CallFrame[] = [{ programId: "p1", instructionIndex: 2 }];
    expect(computeActivePath(stack, "running")).toEqual([2]);
  });

  it("shifts index by -1 when state is an action (move/mine/drop/charge)", () => {
    const stack: CallFrame[] = [{ programId: "p1", instructionIndex: 1 }];
    expect(computeActivePath(stack, "move")).toEqual([0]);
  });

  it("returns null when state is an action and instructionIndex=0 (underflow guard)", () => {
    const stack: CallFrame[] = [{ programId: "p1", instructionIndex: 0 }];
    expect(computeActivePath(stack, "move")).toBeNull();
  });

  it("shifts index by -1 when waitRemaining > 0", () => {
    const stack: CallFrame[] = [
      { programId: "p1", instructionIndex: 2, waitRemaining: 3 },
    ];
    expect(computeActivePath(stack, "running")).toEqual([1]);
  });

  it("does not shift when waitRemaining is 0", () => {
    const stack: CallFrame[] = [
      { programId: "p1", instructionIndex: 2, waitRemaining: 0 },
    ];
    expect(computeActivePath(stack, "running")).toEqual([2]);
  });

  it("builds nested path for 2-frame stack (container + child)", () => {
    const stack: CallFrame[] = [
      { programId: "p1", instructionIndex: 1 }, // LOOP container at index 1
      { programId: "p1", instructionIndex: 0 }, // child running at index 0
    ];
    expect(computeActivePath(stack, "running")).toEqual([1, 0]);
  });

  it("builds nested path when top frame is in an action state", () => {
    const stack: CallFrame[] = [
      { programId: "p1", instructionIndex: 1 },
      { programId: "p1", instructionIndex: 1 }, // выполняет действие по child-инструкции index 0
    ];
    expect(computeActivePath(stack, "mine")).toEqual([1, 0]);
  });

  it("returns null for deeply nested underflow", () => {
    const stack: CallFrame[] = [
      { programId: "p1", instructionIndex: 2 },
      { programId: "p1", instructionIndex: 0 }, // action: 0 - 1 < 0
    ];
    expect(computeActivePath(stack, "mine")).toBeNull();
  });
});
