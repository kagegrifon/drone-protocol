import { describe, it, expect } from "vitest";
import { parseModule } from "./parseModule.js";
import { UnsupportedSyntax } from "./errors.js";

describe("parseModule — exports", () => {
  it("detects a plain exported function with params", () => {
    const mod = parseModule(`export function mineLoop(target, n) {}`);
    expect(mod.exports).toHaveLength(1);
    expect(mod.exports[0].sig).toMatchObject({
      name: "mineLoop",
      params: ["target", "n"],
      isAsync: false,
    });
  });

  it("detects an exported async function", () => {
    const mod = parseModule(`export async function f() {}`);
    expect(mod.exports[0].sig).toMatchObject({ name: "f", isAsync: true });
  });

  it("captures leading JSDoc of an exported function", () => {
    const code = `/**\n * @param {number} n count\n */\nexport function f(n) {}`;
    expect(mod_jsdoc(code)).toContain("@param");
  });

  it("treats a private (non-exported) function as a top-level name, not an export", () => {
    const mod = parseModule(`function helper() {}\nexport function f() {}`);
    expect(mod.exports.map((e) => e.sig.name)).toEqual(["f"]);
    expect(mod.topLevelNames).toContain("helper");
    expect(mod.topLevelNames).toContain("f");
  });
});

describe("parseModule — imports", () => {
  it("detects a named import", () => {
    const mod = parseModule(`import { mineLoop } from "miner";`);
    expect(mod.imports).toHaveLength(1);
    expect(mod.imports[0].specifier).toBe("miner");
    expect(mod.imports[0].names).toEqual([
      { imported: "mineLoop", local: "mineLoop" },
    ]);
  });

  it("detects aliased named import", () => {
    const mod = parseModule(`import { mineLoop as ml } from "miner";`);
    expect(mod.imports[0].names).toEqual([
      { imported: "mineLoop", local: "ml" },
    ]);
  });
});

describe("parseModule — rejected syntax", () => {
  it("rejects export const", () => {
    expect(() => parseModule(`export const x = 1;`)).toThrow(UnsupportedSyntax);
  });

  it("rejects export default", () => {
    expect(() => parseModule(`export default function () {}`)).toThrow(
      UnsupportedSyntax,
    );
  });

  it("rejects export { a, b } list", () => {
    expect(() => parseModule(`function a() {}\nexport { a };`)).toThrow(
      UnsupportedSyntax,
    );
  });

  it("rejects re-export", () => {
    expect(() => parseModule(`export { x } from "other";`)).toThrow(
      UnsupportedSyntax,
    );
  });

  it("rejects default import", () => {
    expect(() => parseModule(`import x from "miner";`)).toThrow(
      UnsupportedSyntax,
    );
  });

  it("rejects namespace import", () => {
    expect(() => parseModule(`import * as m from "miner";`)).toThrow(
      UnsupportedSyntax,
    );
  });
});

function mod_jsdoc(code: string): string {
  const mod = parseModule(code);
  return mod.exports[0].sig.jsdoc ?? "";
}
