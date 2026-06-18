import { describe, it, expect } from "vitest";
import { mission3 } from "./mission3.js";
import { mission4 } from "./mission4.js";

describe("mission3 — shared program structure", () => {
  it("registers shared-loop-m3 as a code program", () => {
    const scene = mission3.buildScene();
    const prog = scene.registry.get("shared-loop-m3")!;
    expect(prog).toBeDefined();
    expect(prog.behavior.sourceForm).toBe("code");
  });
});

describe("mission4 — demo program structure", () => {
  it("registers loop-m4-d1 as a code program", () => {
    const scene = mission4.buildScene();
    const prog = scene.registry.get("loop-m4-d1")!;
    expect(prog).toBeDefined();
    expect(prog.behavior.sourceForm).toBe("code");
  });

  it("registers loop-m4-d2 as a code program", () => {
    const scene = mission4.buildScene();
    const prog = scene.registry.get("loop-m4-d2")!;
    expect(prog).toBeDefined();
    expect(prog.behavior.sourceForm).toBe("code");
  });
});
