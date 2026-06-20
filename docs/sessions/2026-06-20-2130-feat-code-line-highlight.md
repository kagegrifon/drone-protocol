# 2026-06-20 — Подсветка текущей строки кода дрона

## Цель

Реализовать подсветку исполняемой строки кода дрона в редакторе Monaco:
фон строки + glyph-маркер в gutter, обновляемые на каждом `await drone.*`.

## Результаты

Фича полностью реализована и прошла ревью. Все 185 тестов зелёные, type-check чистый.

## Что реализовано

### Task 1 — AST-инструментатор (коммит 2abecbc)
- `src/game/code/worker/instrument.ts` — чистая функция `instrument(code): string`
  через acorn, вставляет `(__line(N), <await-expr>)` перед каждым `await drone.*`
- `src/game/code/worker/instrument.test.ts` — 9 юнит-тестов

### Task 2 — Типы и runtime (коммит 86b33f1)
- `src/game/code/types.ts` — поле `line: number` в `WorkerMessage` для `intent` и `wait`
- `src/game/code/worker/codeRuntime.ts` — переменная `currentLine`, функция `__line(n)`,
  вызов `instrument()`, проброс `line` в исходящие сообщения

### Task 3 — Данные от воркера до DroneState (коммиты 3691d6b + c560d60)
- `src/game/simulation/components/Program.ts` — поле `currentLine?: number | null`
- `src/game/code/CodeBehaviorDriver.ts` — запись `currentLine` из `msg.line`
  при `intent`/`wait`; сброс в `null` при `finished`/`error`/таймауте
- `src/shared/store/gameStore.ts` — `DroneState.currentLine: number | null`,
  заполнение в `snapshotDrones`

### Task 4 — UI Monaco-декорация (коммит 657a5a2)
- `src/ui/editor/CodeEditor/CodeEditor.tsx` — проп `highlightLine?: number | null`,
  `useMonaco()` hook для Range, `createDecorationsCollection`, `glyphMargin: true`
- `src/ui/editor/CodeEditor/codeHighlight.css` — стили: голубой фон строки +
  голубая точка в gutter
- `src/ui/editor/ProgramEditor/index.tsx` — вычисление `activeProgramId`,
  передача `highlightLine` только активной программе

## Что не реализовано (сознательно)

- **Step-режим** (breakpoints, `await __step(N)`) — не входил в scope;
  оставлен комментарий в `instrument.ts` о возможном расширении
- Переход к строке при клике
- Замедление исполнения
- Панель сенсоров
