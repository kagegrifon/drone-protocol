import type {
  ProgramState,
  CallFrame,
} from "../../game/simulation/components/Program.js";

export function computeActivePath(
  callStack: CallFrame[],
  state: ProgramState,
): number[] | null {
  if (callStack.length === 0) return null;

  const path: number[] = [];

  for (let i = 0; i < callStack.length; i++) {
    const frame = callStack[i];
    const isTop = i === callStack.length - 1;

    if (isTop) {
      const isWaiting =
        (state !== "idle" && state !== "running") ||
        (frame.waitRemaining !== undefined && frame.waitRemaining > 0);
      const idx = isWaiting
        ? frame.instructionIndex - 1
        : frame.instructionIndex;
      if (idx < 0) return null;
      path.push(idx);
    } else {
      path.push(frame.instructionIndex);
    }
  }

  return path;
}
