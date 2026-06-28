import { describe, it, expect } from "vitest";
import { dependentsOf } from "./dependentsOf.js";
import type { ProgramDef, ProgramRegistry } from "../../programs/types.js";

function prog(id: string, name: string, code: string): ProgramDef {
  return { id, name, behavior: { sourceForm: "code", code } };
}

function registry(...defs: ProgramDef[]): ProgramRegistry {
  return new Map(defs.map((d) => [d.id, d]));
}

describe("dependentsOf", () => {
  it("includes the program itself", () => {
    const m = prog("m", "Miner", `export function f() {}`);
    expect(dependentsOf("m", registry(m))).toContain("m");
  });

  it("finds a direct importer", () => {
    const m = prog("m", "Miner", `export function f() {}`);
    const e = prog("e", "Entry", `import { f } from "miner";\nf();`);
    const deps = dependentsOf("m", registry(m, e));
    expect(deps).toContain("m");
    expect(deps).toContain("e");
  });

  it("finds transitive importers (C imported by B imported by A)", () => {
    const c = prog("c", "C", `export function c() {}`);
    const b = prog("b", "B", `import { c } from "c";\nexport function b() { c(); }`);
    const a = prog("a", "A", `import { b } from "b";\nb();`);
    const deps = dependentsOf("c", registry(a, b, c));
    expect(new Set(deps)).toEqual(new Set(["a", "b", "c"]));
  });

  it("excludes unrelated programs", () => {
    const m = prog("m", "Miner", `export function f() {}`);
    const other = prog("o", "Other", `await self.mine();`);
    const deps = dependentsOf("m", registry(m, other));
    expect(deps).not.toContain("o");
  });

  it("ignores programs with unparseable code instead of throwing", () => {
    const m = prog("m", "Miner", `export function f() {}`);
    const broken = prog("b", "Broken", `import { f } from "miner" oops!!!`);
    expect(() => dependentsOf("m", registry(m, broken))).not.toThrow();
  });
});
