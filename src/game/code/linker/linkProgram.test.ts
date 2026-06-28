import { describe, it, expect } from "vitest";
import { linkProgram } from "./linkProgram.js";
import {
  CycleError,
  UnknownSpecifier,
  MissingExport,
  DuplicateSlug,
} from "./errors.js";
import type { ProgramDef, ProgramRegistry } from "../../programs/types.js";

function prog(id: string, name: string, code: string): ProgramDef {
  return { id, name, behavior: { sourceForm: "code", code } };
}

function registry(...defs: ProgramDef[]): ProgramRegistry {
  return new Map(defs.map((d) => [d.id, d]));
}

describe("linkProgram — basic inlining", () => {
  it("a program with no imports/exports is emitted unchanged", () => {
    const reg = registry(prog("e", "Entry", `await self.mine();`));
    const { code } = linkProgram("e", reg);
    expect(code).toContain("await self.mine();");
    expect(code).not.toContain("import");
    expect(code).not.toContain("export");
  });

  it("inlines one imported module and namespaces its function", () => {
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

    expect(code).toContain("async function __mod_miner__mineLoop()");
    // call site rewritten to namespaced name
    expect(code).toContain("await __mod_miner__mineLoop();");
    expect(code).not.toContain("import");
    expect(code).not.toContain("export ");
  });

  it("keeps entry top-level body executable (not namespaced)", () => {
    const miner = prog("m", "Miner", `export function f() {}`);
    const entry = prog(
      "e",
      "Entry",
      `import { f } from "miner";\nlet x = 1;\nf();`,
    );
    const { code } = linkProgram("e", registry(miner, entry));
    expect(code).toContain("let x = 1;");
    expect(code).toContain("__mod_miner__f();");
  });
});

describe("linkProgram — transitive graph", () => {
  it("emits A→B→C in topological order (deps before dependents)", () => {
    const c = prog("c", "C", `export function c() {}`);
    const b = prog(
      "b",
      "B",
      `import { c } from "c";\nexport function b() { c(); }`,
    );
    const a = prog("a", "A", `import { b } from "b";\nb();`);
    const { code } = linkProgram("a", registry(a, b, c));
    const posC = code.indexOf("__mod_c__c");
    const posB = code.indexOf("__mod_b__b");
    expect(posC).toBeGreaterThanOrEqual(0);
    expect(posB).toBeGreaterThanOrEqual(0);
    // C's definition must appear before B's definition
    expect(code.indexOf("function __mod_c__c")).toBeLessThan(
      code.indexOf("function __mod_b__b"),
    );
  });

  it("diamond A→B,C→D emits D exactly once", () => {
    const d = prog("d", "D", `export function d() {}`);
    const b = prog(
      "b",
      "B",
      `import { d } from "d";\nexport function b() { d(); }`,
    );
    const c = prog(
      "c",
      "C",
      `import { d } from "d";\nexport function c() { d(); }`,
    );
    const a = prog(
      "a",
      "A",
      `import { b } from "b";\nimport { c } from "c";\nb(); c();`,
    );
    const { code } = linkProgram("a", registry(a, b, c, d));
    const matches = code.match(/function __mod_d__d/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});

describe("linkProgram — errors", () => {
  it("throws CycleError on A↔B", () => {
    const a = prog(
      "a",
      "A",
      `import { b } from "b";\nexport function a() { b(); }`,
    );
    const b = prog(
      "b",
      "B",
      `import { a } from "a";\nexport function b() { a(); }`,
    );
    expect(() => linkProgram("a", registry(a, b))).toThrow(CycleError);
  });

  it("throws UnknownSpecifier for missing module", () => {
    const entry = prog("e", "Entry", `import { x } from "nope";\nx();`);
    expect(() => linkProgram("e", registry(entry))).toThrow(UnknownSpecifier);
  });

  it("throws MissingExport when name not exported", () => {
    const miner = prog("m", "Miner", `export function other() {}`);
    const entry = prog(
      "e",
      "Entry",
      `import { mineLoop } from "miner";\nmineLoop();`,
    );
    expect(() => linkProgram("e", registry(miner, entry))).toThrow(
      MissingExport,
    );
  });

  it("throws DuplicateSlug when two programs share a slug", () => {
    const m1 = prog("m1", "Miner", `export function f() {}`);
    const m2 = prog("m2", "miner", `export function g() {}`);
    const entry = prog("e", "Entry", `import { f } from "miner";\nf();`);
    expect(() => linkProgram("e", registry(m1, m2, entry))).toThrow(
      DuplicateSlug,
    );
  });
});

describe("linkProgram — scope-aware renaming", () => {
  it("does not rename a shadowing local parameter", () => {
    const miner = prog("m", "Miner", `export function helper() {}`);
    // entry has its own param named `helper` — must NOT be rewritten
    const entry = prog(
      "e",
      "Entry",
      `import { helper } from "miner";\nfunction local(helper) { return helper; }\nhelper();`,
    );
    const { code } = linkProgram("e", registry(miner, entry));
    // the param usage stays `return helper`, the import call becomes namespaced
    expect(code).toContain("return helper");
    expect(code).toContain("__mod_miner__helper();");
  });

  it("avoids private-name collisions between two modules", () => {
    // both modules define a private `helper`; namespacing keeps them distinct
    const b = prog(
      "b",
      "B",
      `function helper() { return 1; }\nexport function b() { return helper(); }`,
    );
    const c = prog(
      "c",
      "C",
      `function helper() { return 2; }\nexport function c() { return helper(); }`,
    );
    const a = prog(
      "a",
      "A",
      `import { b } from "b";\nimport { c } from "c";\nb(); c();`,
    );
    const { code } = linkProgram("a", registry(a, b, c));
    expect(code).toContain("function __mod_b__helper");
    expect(code).toContain("function __mod_c__helper");
    expect(code).toContain("return __mod_b__helper()");
    expect(code).toContain("return __mod_c__helper()");
  });

  it("does not rewrite object property keys named like a top-level binding", () => {
    const miner = prog("m", "Miner", `export function f() {}`);
    const entry = prog(
      "e",
      "Entry",
      `import { f } from "miner";\nconst o = { f: 1 };\nf();`,
    );
    const { code } = linkProgram("e", registry(miner, entry));
    expect(code).toContain("{ f: 1 }");
    expect(code).toContain("__mod_miner__f();");
  });
});

describe("linkProgram — lineMap", () => {
  it("maps a glued line back to entry program + original line", () => {
    const miner = prog("m", "Miner", `export function f() {}`);
    // entry body: line 1 = import, line 2 = await self.mine()
    const entry = prog(
      "e",
      "Entry",
      `import { f } from "miner";\nawait self.mine();`,
    );
    const { code, lineMap } = linkProgram("e", registry(miner, entry));
    const gluedLine =
      code.split("\n").findIndex((l) => l.includes("self.mine")) + 1;
    const mapped = lineMap.find(
      (m) => gluedLine >= m.fromLine && gluedLine <= m.toLine,
    );
    expect(mapped).toBeDefined();
    expect(mapped!.programId).toBe("e");
    // `await self.mine()` was original line 2 of the entry program
    const origLine = gluedLine - mapped!.fromLine + mapped!.origLine;
    expect(origLine).toBe(2);
  });
});
