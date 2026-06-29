import { describe, it, expect } from "vitest";
import { parse } from "acorn";
import { linkProgram } from "./linkProgram.js";
import { instrument } from "../worker/instrument.js";
import type { ProgramDef, ProgramRegistry } from "../../programs/types.js";

function prog(id: string, name: string, code: string): ProgramDef {
  return { id, name, behavior: { sourceForm: "code", code } };
}

function registry(...defs: ProgramDef[]): ProgramRegistry {
  return new Map(defs.map((d) => [d.id, d]));
}

const AsyncFunction = Object.getPrototypeOf(async function () {})
  .constructor as new (...args: string[]) => unknown;

// Воспроизводит цепочку воркера: link → instrument → new AsyncFunction.
function buildable(entryId: string, reg: ProgramRegistry): void {
  const { code } = linkProgram(entryId, reg);
  // 1. Парсится под опциями instrument.ts (он сам парсит внутри).
  parse(code, {
    ecmaVersion: 2020,
    locations: true,
    allowAwaitOutsideFunction: true,
  });
  // 2. Инструментируется без ошибок.
  const instrumented = instrument(code);
  // 3. Собирается в тело AsyncFunction без SyntaxError.
  new AsyncFunction("self", "World", "__line", "__call", instrumented);
}

describe("linker output ↔ instrument compatibility", () => {
  it("links + instruments + builds an AsyncFunction for an imported module", () => {
    const miner = prog(
      "m",
      "Miner",
      `export async function mineLoop() {\n  await self.moveTo({ x: 1, y: 1 });\n  await self.mine();\n}`,
    );
    const entry = prog(
      "e",
      "Entry",
      `import { mineLoop } from "miner";\nwhile (true) {\n  await mineLoop();\n}`,
    );
    expect(() => buildable("e", registry(miner, entry))).not.toThrow();
  });

  it("handles a transitive chain A→B→C", () => {
    const c = prog(
      "c",
      "C",
      `export async function deep() { await self.mine(); }`,
    );
    const b = prog(
      "b",
      "B",
      `import { deep } from "c";\nexport async function mid() { await deep(); }`,
    );
    const a = prog("a", "A", `import { mid } from "b";\nawait mid();`);
    expect(() => buildable("a", registry(a, b, c))).not.toThrow();
  });

  it("instruments self.* calls inside an imported module body", () => {
    const miner = prog(
      "m",
      "Miner",
      `export async function mineLoop() { await self.mine(); }`,
    );
    const entry = prog(
      "e",
      "Entry",
      `import { mineLoop } from "miner";\nawait mineLoop();`,
    );
    const { code } = linkProgram("e", registry(miner, entry));
    const instrumented = instrument(code);
    // __line(...) вставлен вокруг await self.mine() внутри модульной функции.
    expect(instrumented).toContain("__line(");
    expect(instrumented).toContain("self.mine()");
  });
});
