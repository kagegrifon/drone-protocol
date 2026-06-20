import { describe, it, expect } from "vitest";
import { instrument } from "./instrument.js";

describe("instrument", () => {
  it("вставляет __line перед await drone.mine()", () => {
    const code = `await drone.mine();`;
    const result = instrument(code);
    // строка 1 (acorn считает от 1)
    expect(result).toContain("__line(1)");
    expect(result).toContain("await drone.mine()");
    // должен быть валидным JS — AsyncFunction не должен бросать
    expect(() => {
      const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
      new AsyncFn("drone", "__line", result);
    }).not.toThrow();
  });

  it("вставляет __line перед await drone.moveTo()", () => {
    const code = `await drone.moveTo(ore);`;
    const result = instrument(code);
    expect(result).toContain("__line(1)");
    expect(result).toContain("await drone.moveTo(ore)");
  });

  it("вставляет __line перед await drone.wait()", () => {
    const code = `await drone.wait(2);`;
    const result = instrument(code);
    expect(result).toContain("__line(1)");
    expect(result).toContain("await drone.wait(2)");
  });

  it("не вставляет __line перед другими await", () => {
    const code = `await Promise.resolve(); await drone.mine();`;
    const result = instrument(code);
    // ровно один __line
    expect(result.match(/__line\(/g)?.length ?? 0).toBe(1);
  });

  it("многострочный код — строка привязана к началу await", () => {
    const code = `const x = 1;\nawait drone.mine();\nawait drone.drop();`;
    const result = instrument(code);
    expect(result).toContain("__line(2)");
    expect(result).toContain("__line(3)");
  });

  it("многострочный вызов — строка начала ExpressionStatement", () => {
    const code = `await drone\n  .moveTo(\n    ore\n  );`;
    const result = instrument(code);
    expect(result).toContain("__line(1)");
  });

  it("игнорирует вызовы в комментариях", () => {
    const code = `// await drone.mine()\nawait drone.drop();`;
    const result = instrument(code);
    expect(result.match(/__line\(/g)?.length ?? 0).toBe(1);
    expect(result).toContain("__line(2)");
  });

  it("игнорирует вызовы в строковых литералах", () => {
    const code = `const s = "await drone.mine()";\nawait drone.charge();`;
    const result = instrument(code);
    expect(result.match(/__line\(/g)?.length ?? 0).toBe(1);
    expect(result).toContain("__line(2)");
  });

  it("выдаёт валидный исполнимый JS для нетривиального кода", () => {
    const code = `
while (true) {
  await drone.moveTo(mine);
  await drone.mine();
  await drone.moveTo(base);
  await drone.drop();
}
    `.trim();
    const result = instrument(code);
    expect(() => {
      const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
      new AsyncFn("drone", "__line", "mine", "base", result);
    }).not.toThrow();
    expect(result.match(/__line\(/g)?.length ?? 0).toBe(4);
  });
});
