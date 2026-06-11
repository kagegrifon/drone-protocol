# Сессия 2026-06-11 — Code Mode, Этап 2, Phase G (исправление)

## Цель

Исправить e2e-тест Phase G (`code-mode.spec.ts`): ввод кода добычи → запуск миссии → дрон добывает руду и сохраняет результаты.

## Проблема

E2e падал с `code execution timeout (1000ms)`, дрон не двигался. Воркер не отвечал на `postMessage`, хотя код был корректен.

**Корневая причина:** паттерн `new Worker(new URL("./entry.ts", import.meta.url), { type: "module" })` в `BrowserWorkerPort.ts` молча ломается под HMR в dev-режиме Vite. Когда React-компонент перемонтируется, `import.meta.url` приходит с `?t=<timestamp>`, worker-трансформация Vite не срабатывает, воркер грузится как обычный модуль → `onmessage` никогда не вызывается.

Диагностирован через `page.on("worker")` в Playwright (наш воркер не создавался) и логи worker-модуля (не выполнялся).

## Решение

1. **`src/game/code/worker/BrowserWorkerPort.ts`** — перейти на Vite-нативный импорт:
   ```ts
   import BrowserWorkerEntry from "./browserWorkerEntry.ts?worker";
   this.worker = new BrowserWorkerEntry();
   ```
   Надёжен и HMR-устойчив (отдаёт стабильный `?worker_file&type=module`).

2. **`src/game/code/CodeBehaviorDriver.ts`** — `DEFAULT_TIMEOUT_MS` 1000 → 10000ms.
   Холодный старт worker-модуля под Vite dev (компиляция + конкуренция с Monaco TS-воркером) занимает до нескольких секунд.

3. **`e2e/code-mode.spec.ts`** — исправить тестовый код добычи:
   ```js
   while (drone.inventory < max) {
     await drone.moveTo(2);   // в каждой итерации
     await drone.mine();
   }
   ```
   Один `moveTo` лишь задаёт путь; проезд занимает несколько тиков.

## Проверка

- `npm run type-check` — чисто.
- `npx vitest run` — 254/254 ✓.
- `npx playwright test e2e/code-mode.spec.ts` — ✓ (27.2s, дрон добыл руду `ORE>0`).

## Метрики сессии

- Модель: claude-haiku-4-5-20251001
- Корневая причина найдена систематической диагностикой (Phase 1-3, без гадания).
- Commit: `69f59e8` fix: исправить Worker в dev-режиме Vite через ?worker импорт (Phase G)
