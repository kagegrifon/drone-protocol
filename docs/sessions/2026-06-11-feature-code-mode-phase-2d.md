# Сессия 2026-06-11 — Code Mode, Этап 2, Phase D

## Цель

Реализовать Phase D плана `1-code-squishy-eagle.md` (этап 2 Code Mode):
подключить Monaco editor к Vite-сборке — зависимости, воркеры, типы из
`drone-api.d.ts`.

## Результаты

- `package.json` — добавлены `@monaco-editor/react@^4.7.0` и
  `monaco-editor@^0.55.1` в `dependencies`.
- `vite.config.ts` — добавлен `optimizeDeps.exclude: ["monaco-editor"]`
  (рекомендация для Vite, чтобы избежать повторной инициализации воркеров
  в dev).
- Новый `src/ui/editor/CodeEditor/monacoSetup.ts` — `setupMonaco()`:
  - `MonacoEnvironment.getWorker` — `ts`/`js` → `ts.worker`, остальное →
    `editor.worker` (импорты через `?worker`).
  - `loader.config({ monaco })` — подключает локально установленный
    `monaco-editor` вместо CDN.
  - `typescript.typescriptDefaults.setCompilerOptions` (ES2020, strict,
    noEmit) и `addExtraLib(droneApiDts)` — типы `drone-api.d.ts`
    подключены через `?raw`-импорт.

  Важное отличие от исходного плана: в `monaco-editor@0.55.1` namespace
  `monaco.languages.typescript` помечен как `@deprecated` (`{ deprecated:
  true }`, без полей). Актуальный путь — именованный экспорт `typescript`
  из пакета `monaco-editor` (`import { typescript } from "monaco-editor"`),
  который и используется.

## Проверка

- `npm run type-check` — чисто.
- `npx vitest run` — 254/254 тестов проходят (26 файлов).
- Вручную: временно отрендерили `<Editor>` в `App.tsx`, `npm run dev` —
  Monaco грузится без ошибок консоли; автодополнение `drone.` показывает
  `mine` (и другие методы) из `drone-api.d.ts` — типы подключены корректно.
  Изменения в `App.tsx` отменены (`git checkout`).
- `npm run build && npm run preview` — сборка проходит чисто (Monaco пока
  нигде не импортируется в продакшен-коде, появится в Phase E).
  Обнаруженный 404 на `assets/index-*.js` под `/drone-protocol/` в
  Playwright — **существующая проблема**, воспроизводится и на чистом
  `main` без изменений Phase D (curl возвращает 200, файл на месте);
  не связана с этой фазой.

## Следующий шаг — Phase E

Создать `src/ui/editor/CodeEditor/CodeEditor.tsx` — компонент `<CodeEditor>`
на основе `@monaco-editor/react`, вызывающий `setupMonaco()` и
оборачивающий `<Editor>` (см. план, секция Phase E).

## Метрики сессии
- Модель: claude-sonnet-4-6
