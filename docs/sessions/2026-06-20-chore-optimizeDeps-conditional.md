# Сессия 2026-06-20 — optimizeDeps.exclude условная по CI

## Цель

Исследовать `optimizeDeps.exclude: ["monaco-editor"]` в `vite.config.ts` и при возможности убрать.

## Контекст

Строка была добавлена в Phase 2.4 (коммит `6ce239c`) как рекомендация для Vite: Monaco регистрирует воркеры через `MonacoEnvironment.getWorker` с `?worker`-импортами. Если Vite пребандлит Monaco через esbuild, он не понимает Vite-специфичные суффиксы внутри `node_modules` — воркеры превращаются в обычные модули и Monaco ломается в dev.

Ранее (сессия 2026-06-20) e2e тесты были переведены на `vite preview` (production-сборка) в CI, потому что в headless CI Monaco без пребандлинга грузил 2300+ ESM-модулей, перегружал event loop и тесты падали по таймауту.

## Результат

`optimizeDeps.exclude` стала **условной**: включается только локально (`!isCI`), в CI — пустой `optimizeDeps: {}`.

- В **dev** (`npm run dev`): `exclude` остаётся — esbuild не трогает Monaco, воркеры работают корректно через `?worker`.
- В **CI** (`npm run build`): Rollup корректно обрабатывает `?worker`, `exclude` не нужна.
- **e2e в CI** остались на `vite preview` — это правильно независимо от Monaco: тесты проверяют production-сборку, а не dev-артефакты.

## Изменения

- `vite.config.ts` — добавлен `const isCI = !!process.env.CI`, `optimizeDeps` условный.
- `DECISIONS.md` — обновлена запись с объяснением условной логики.

## Метрики сессии

- Модель: claude-sonnet-4-6
