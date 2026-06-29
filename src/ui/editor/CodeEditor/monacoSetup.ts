import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { typescript } from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import droneApiDts from "@/game/code/drone-api.d.ts?raw";
import type { ProgramDef } from "@/game/programs/types.js";
import { genModuleDts } from "@/game/code/linker/genModuleDts.js";

let initialized = false;

/** URI извлекаемого .d.ts с `declare module`-ами импортируемых программ. */
const MODULE_LIBS_URI = "file:///drone-modules.d.ts";
/** Disposable предыдущей регистрации module-libs — дропаем при обновлении. */
let moduleLibsDisposable: monaco.IDisposable | null = null;
/** Последний эмитированный .d.ts — чтобы не перерегистрировать без изменений. */
let lastModuleDts = "";

/**
 * Глобальная настройка Monaco: воркеры, типы drone-api, compiler options.
 * Вызывается один раз перед первым рендером <CodeEditor>.
 */
export function setupMonaco(): void {
  if (initialized) return;
  initialized = true;

  self.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      if (label === "typescript" || label === "javascript") {
        return new tsWorker();
      }
      return new editorWorker();
    },
  };

  loader.config({ monaco });

  // target/module/moduleDetection задаём числовыми константами TS-компилятора.
  // Почему не `typescript.ScriptTarget.*`: реэкспорт enum из monaco-editor тянет
  // значения из внешней версии typescript, не совпадающей с зашитой в ts.worker, —
  // setCompilerOptions получал неверные/undefined индексы, target/module не
  // применялись (top-level await ругался). Почему не строки ("es2022"/"esnext"):
  // ts.worker применяет их к диагностике (ошибки уходят), но при этом ломается
  // автодополнение (self./World. перестают предлагать). Числа дают и чистую
  // диагностику, и работающие подсказки.
  const ScriptTarget_ES2022 = 9 as typescript.ScriptTarget;
  const ModuleKind_ESNext = 99 as typescript.ModuleKind;
  const ModuleDetectionKind_Force = 3;

  typescript.typescriptDefaults.setCompilerOptions({
    // ES2022 + ESNext-модуль разрешают top-level await: код игрока пишется как
    // тело async-функции (await self.moveTo(...)), и без этого Monaco подчёркивал
    // бы каждый await на верхнем уровне.
    target: ScriptTarget_ES2022,
    module: ModuleKind_ESNext,
    // Код игрока не содержит import/export, поэтому TS считал бы его скриптом и
    // запрещал top-level await. Force трактует модель как модуль → await на верхнем
    // уровне разрешён. Глобальные `self`/`World` идут амбиентным extraLib и остаются
    // видны в модулях.
    moduleDetection: ModuleDetectionKind_Force,
    // lib без "dom": в lib.dom есть глобальный `self: Window`, который конфликтует
    // с нашим `declare const self: DroneApi` (self превращался в Window без методов
    // дрона). Оставляем только es2022 — игроку DOM не нужен.
    lib: ["es2022"],
    strict: true,
    noEmit: true,
    allowNonTsExtensions: true,
  });
  typescript.typescriptDefaults.addExtraLib(
    droneApiDts,
    "file:///drone-api.d.ts",
  );
}

/**
 * Перерегистрирует `declare module`-типы импортируемых программ как extraLib,
 * чтобы `import { f } from "miner"` типизировался в Monaco. Вызывается при
 * изменении списка программ. Амбиентный drone-api.d.ts не трогается — это
 * отдельный extraLib. No-op, если набор модулей не изменился.
 */
export function updateModuleLibs(programs: ProgramDef[]): void {
  const dts = genModuleDts(programs);
  if (dts === lastModuleDts) return;
  lastModuleDts = dts;

  moduleLibsDisposable?.dispose();
  moduleLibsDisposable = typescript.typescriptDefaults.addExtraLib(
    dts,
    MODULE_LIBS_URI,
  );
}

/**
 * Сбрасывает зарегистрированные module-libs и кэш последнего .d.ts. Вызывается
 * при загрузке миссии: module-libs живут в синглтоне на весь срок вкладки, и без
 * сброса extraLib предыдущей миссии остаётся в Monaco. Особенно опасно совпадение
 * .d.ts двух миссий — тогда кэш `lastModuleDts` дал бы ложный no-op в
 * updateModuleLibs, и старые типы пережили бы перезаход (автокомплит для прошлой
 * миссии, импорты текущей подчёркнуты как ошибка).
 */
export function resetModuleLibs(): void {
  moduleLibsDisposable?.dispose();
  moduleLibsDisposable = null;
  lastModuleDts = "";
}
