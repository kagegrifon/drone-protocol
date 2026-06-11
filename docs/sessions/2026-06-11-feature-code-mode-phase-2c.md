# Сессия 2026-06-11 — Code Mode, Этап 2, Phase C

## Цель

Реализовать Phase C плана `1-code-squishy-eagle.md` (этап 2 Code Mode):
подключить `CodeBehaviorDriver` в `gameStore.init()`, чтобы код игрока
действительно выполнялся в реальной игре (а не только в тестах).

## Результаты

- `src/shared/store/gameStore.ts`:
  - `init()` теперь создаёт `codeDriver = new CodeBehaviorDriver({ createPort })`
    и передаёт его в `ProgramExecutionSystem`. По умолчанию `createPort` — `() =>
    new BrowserWorkerPort()`; для тестов сигнатура `init()` принимает 4-й
    необязательный аргумент `options?: { createPort?: () => CodeWorkerPort }`,
    позволяющий подставить `NodeWorkerPort` в Vitest (node-окружение).
  - При повторном `init()` (рестарт/смена миссии) освобождает worker-сессии
    предыдущего `codeDriver` через `_systems.programExecution.dispose()`.
- `src/game/simulation/systems/ProgramExecutionSystem.ts` — добавлен метод
  `dispose()`, вызывающий `this.codeDriver?.disposeAll()`.
- Новый тест в `gameStore.test.ts`: создаётся мир с дроном, у которого
  personal-программа `behaviorMode: "code"` и `codeSource: "await drone.mine();"`,
  плюс `Deposit` под дроном (без него `MiningSystem` сразу сбрасывает
  `state: "mine"` обратно в `"running"` в том же тике). `init()` вызывается с
  `createPort: () => new NodeWorkerPort()`, далее `tick()` в цикле — дрон
  доходит до `state === "mine"`.

## Проверка

- `npm run type-check` — чисто.
- `npx vitest run` — **254/254 тестов проходят** (26 файлов).

## Следующий шаг — Phase D

Подключить Monaco editor + Vite (см. план `1-code-squishy-eagle.md`, секция
Phase D): добавить `@monaco-editor/react` и `monaco-editor` в зависимости,
проверить резолв `?worker`-импортов под `base: "/drone-protocol/"`, создать
`src/ui/editor/CodeEditor/monacoSetup.ts`.

## Метрики сессии
- Модель: claude-sonnet-4-6
- Input: 3,980 токенов (кеш: 8,865,252 / запись в кеш: 316,344)
- Output: 44,120 токенов
- Контекст: 102,141 / 200,000 токенов (51.1%)
- Стоимость: $4.520
