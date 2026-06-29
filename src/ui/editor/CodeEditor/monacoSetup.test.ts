import { describe, test, expect, vi, beforeEach } from "vitest";
import type { ProgramDef } from "@/game/programs/types.js";

// Перехватываем addExtraLib/dispose: реальный monaco-editor тянет воркеры и DOM,
// в Vitest нам нужны только вызовы typescript-defaults. vi.hoisted — чтобы спаи
// были доступны внутри hoisted-фабрики vi.mock.
const { disposeSpy, addExtraLib } = vi.hoisted(() => {
  const dispose = vi.fn();
  return { disposeSpy: dispose, addExtraLib: vi.fn(() => ({ dispose })) };
});

vi.mock("monaco-editor", () => ({
  typescript: {
    typescriptDefaults: {
      setCompilerOptions: vi.fn(),
      addExtraLib,
    },
    ScriptTarget: {},
    ModuleKind: {},
  },
}));

vi.mock("@monaco-editor/react", () => ({ loader: { config: vi.fn() } }));
vi.mock("monaco-editor/esm/vs/editor/editor.worker?worker", () => ({
  default: class {},
}));
vi.mock("monaco-editor/esm/vs/language/typescript/ts.worker?worker", () => ({
  default: class {},
}));
vi.mock("@/game/code/drone-api.d.ts?raw", () => ({ default: "" }));

import { updateModuleLibs, resetModuleLibs } from "./monacoSetup.js";

function programWithExport(name: string): ProgramDef {
  return {
    id: name,
    name,
    behavior: { sourceForm: "code", code: `export async function go() {}` },
  };
}

beforeEach(() => {
  addExtraLib.mockClear();
  disposeSpy.mockClear();
  resetModuleLibs();
  addExtraLib.mockClear();
});

describe("updateModuleLibs", () => {
  test("регистрирует extraLib для программ с экспортами", () => {
    updateModuleLibs([programWithExport("miner")]);
    expect(addExtraLib).toHaveBeenCalledTimes(1);
  });

  test("не перерегистрирует при неизменном наборе модулей", () => {
    const programs = [programWithExport("miner")];
    updateModuleLibs(programs);
    updateModuleLibs(programs);
    expect(addExtraLib).toHaveBeenCalledTimes(1);
  });
});

describe("resetModuleLibs", () => {
  test("после сброса тот же набор модулей регистрируется заново", () => {
    const programs = [programWithExport("miner")];
    updateModuleLibs(programs);
    expect(addExtraLib).toHaveBeenCalledTimes(1);

    // Сценарий перезахода в миссию: новая миссия со СЛУЧАЙНО тем же dts.
    resetModuleLibs();
    updateModuleLibs(programs);

    expect(disposeSpy).toHaveBeenCalled();
    expect(addExtraLib).toHaveBeenCalledTimes(2);
  });
});
