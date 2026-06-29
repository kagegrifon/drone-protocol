import { describe, it, expect } from "vitest";
import { instrument } from "./instrument.js";

describe("instrument", () => {
  it("вставляет __line перед await self.mine()", () => {
    const code = `await self.mine();`;
    const result = instrument(code);
    // строка 1 (acorn считает от 1)
    expect(result).toContain("__line(1)");
    expect(result).toContain("await self.mine()");
    // должен быть валидным JS — AsyncFunction не должен бросать
    expect(() => {
      const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
      new AsyncFn("self", "__line", result);
    }).not.toThrow();
  });

  it("вставляет __line перед await self.moveTo()", () => {
    const code = `await self.moveTo({ x: 1, y: 1 });`;
    const result = instrument(code);
    expect(result).toContain("__line(1)");
    expect(result).toContain("await self.moveTo({ x: 1, y: 1 })");
  });

  it("вставляет __line перед await self.wait()", () => {
    const code = `await self.wait(2);`;
    const result = instrument(code);
    expect(result).toContain("__line(1)");
    expect(result).toContain("await self.wait(2)");
  });

  it("не вставляет __line перед другими await", () => {
    const code = `await Promise.resolve(); await self.mine();`;
    const result = instrument(code);
    // ровно один __line
    expect(result.match(/__line\(/g)?.length ?? 0).toBe(1);
  });

  it("многострочный код — строка привязана к началу await", () => {
    const code = `const x = 1;\nawait self.mine();\nawait self.drop();`;
    const result = instrument(code);
    expect(result).toContain("__line(2)");
    expect(result).toContain("__line(3)");
  });

  it("многострочный вызов — строка начала ExpressionStatement", () => {
    const code = `await self\n  .moveTo(\n    { x: 1, y: 1 }\n  );`;
    const result = instrument(code);
    expect(result).toContain("__line(1)");
  });

  it("игнорирует вызовы в комментариях", () => {
    const code = `// await self.mine()\nawait self.drop();`;
    const result = instrument(code);
    expect(result.match(/__line\(/g)?.length ?? 0).toBe(1);
    expect(result).toContain("__line(2)");
  });

  it("игнорирует вызовы в строковых литералах", () => {
    const code = `const s = "await self.mine()";\nawait self.charge();`;
    const result = instrument(code);
    expect(result.match(/__line\(/g)?.length ?? 0).toBe(1);
    expect(result).toContain("__line(2)");
  });

  it("выдаёт валидный исполнимый JS для нетривиального кода", () => {
    const code = `
while (true) {
  await self.moveTo({ x: 1, y: 1 });
  await self.mine();
  await self.moveTo({ x: 2, y: 2 });
  await self.drop();
}
    `.trim();
    const result = instrument(code);
    expect(() => {
      const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
      new AsyncFn("self", "__line", "mine", "base", result);
    }).not.toThrow();
    expect(result.match(/__line\(/g)?.length ?? 0).toBe(4);
  });

  it("корректно обрабатывает вложенные while без точек с запятой (backward compat)", async () => {
    const code = `while (true) {
  while (self.inventory === 0) {
    await self.moveTo({ x: 1, y: 1 })
    await self.mine()
  }
  while (self.inventory > 0) {
    await self.drop()
  }
}`;
    const result = instrument(code);
    expect(result.match(/__line\(/g)?.length ?? 0).toBe(3);

    // Запускаем инструментированный код с mock-дроном.
    // inventory начинает с 0 → входим во внутренний while → после moveTo+mine inventory=1
    // → выходим, входим в drop-while → после drop inventory=0 → бросаем исключение чтобы выйти из outer while
    let callCount = 0;
    const self = {
      get inventory() {
        return callCount < 2 ? 0 : 1;
      },
      moveTo: async () => {
        callCount++;
      },
      mine: async () => {
        callCount++;
      },
      drop: async () => {
        throw new Error("stop");
      },
    };
    const __line = () => {};
    const AsyncFn = Object.getPrototypeOf(async function () {})
      .constructor as new (
      ...args: string[]
    ) => (...args: unknown[]) => Promise<void>;
    const fn = new AsyncFn("self", "__line", result);
    await expect(fn(self, __line)).rejects.toThrow("stop");
  });
});

describe("instrument — __mod_* calls", () => {
  it("оборачивает await __mod_*() вызов в __call", () => {
    // Имитируем склеенный код: модульная функция с await
    const code = `await __mod_my__goToBase();`;
    const result = instrument(code);
    expect(result).toContain("__call(");
    expect(result).toContain("__mod_my__goToBase()");
    // await должен быть снаружи __call, а не внутри
    expect(result).toMatch(/await __call\(\d+,/);
  });

  it("оборачивает синхронный __mod_*() вызов в __call (без await)", () => {
    const code = `__mod_my__helper();`;
    const result = instrument(code);
    expect(result).toContain("__call(");
    expect(result).toContain("__mod_my__helper()");
  });

  it("не трогает обычные вызовы self.* и локальные хелперы", () => {
    const code = `await self.mine();\nhelperFn();`;
    const result = instrument(code);
    expect(result).not.toMatch(/__call\(/);
    expect(result).toContain("__line(");
  });

  it("правильно обрабатывает __mod_* с аргументами", () => {
    const code = `await __mod_utils__moveTo({ x: 1, y: 2 });`;
    const result = instrument(code);
    expect(result).toMatch(/await __call\(\d+, \(\) => __mod_utils__moveTo\(\{ x: 1, y: 2 \}\)\)/);
  });

  it("сохраняет __line для await self.* внутри кода рядом с __mod_* вызовами", () => {
    const code = `await self.mine();\nawait __mod_my__fn();`;
    const result = instrument(code);
    expect(result).toContain("__line(1)");  // для self.mine()
    expect(result).toContain("__call(2,");  // для __mod_my__fn()
  });
});
