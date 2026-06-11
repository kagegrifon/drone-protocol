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

  typescript.typescriptDefaults.setCompilerOptions({
    target: typescript.ScriptTarget.ES2020,
    strict: true,
    noEmit: true,
    allowNonTsExtensions: true,
  });
  typescript.typescriptDefaults.addExtraLib(
    droneApiDts,
    "file:///drone-api.d.ts",
  );
}
