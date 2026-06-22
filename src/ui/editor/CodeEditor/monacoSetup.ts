import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { typescript } from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import droneApiDts from "@/game/code/drone-api.d.ts?raw";

let initialized = false;

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
