import { describe, it, expect } from "vitest";
import { genModuleDts } from "./genModuleDts.js";
import type { ProgramDef } from "../../programs/types.js";

function prog(id: string, name: string, code: string): ProgramDef {
  return { id, name, behavior: { sourceForm: "code", code } };
}

describe("genModuleDts", () => {
  it("emits a declare module for a program with exports", () => {
    const dts = genModuleDts([
      prog("m", "Miner", `export async function mineLoop() {}`),
    ]);
    expect(dts).toContain('declare module "miner"');
    expect(dts).toContain("export function mineLoop");
  });

  it("skips programs without exports", () => {
    const dts = genModuleDts([prog("e", "Entry", `await self.mine();`)]);
    expect(dts.trim()).toBe("");
  });

  it("falls back to any[] params when there is no JSDoc", () => {
    const dts = genModuleDts([
      prog("m", "Miner", `export function f(a, b) {}`),
    ]);
    expect(dts).toContain("f(...args: any[])");
  });

  it("copies JSDoc @param types into the signature", () => {
    const code = `/**\n * @param {number} n count\n * @param {string} label\n */\nexport function f(n, label) {}`;
    const dts = genModuleDts([prog("m", "Miner", code)]);
    expect(dts).toContain("f(n: number, label: string)");
  });

  it("uses @returns type when present", () => {
    const code = `/**\n * @returns {number}\n */\nexport function f() {}`;
    const dts = genModuleDts([prog("m", "Miner", code)]);
    expect(dts).toContain("): number");
  });

  it("defaults return type to Promise<void>", () => {
    const dts = genModuleDts([prog("m", "Miner", `export function f() {}`)]);
    expect(dts).toContain("): Promise<void>");
  });

  it("ignores programs with unparseable code", () => {
    const ok = prog("m", "Miner", `export function f() {}`);
    const broken = prog("b", "Broken", `export function ((( oops`);
    expect(() => genModuleDts([ok, broken])).not.toThrow();
    const dts = genModuleDts([ok, broken]);
    expect(dts).toContain('declare module "miner"');
  });
});
