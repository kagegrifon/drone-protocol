# Step-debug Stack-trace (этап A) — Шаги 1–4

**Дата:** 2026-06-29 (20:00+)
**Ветка:** `feat/step-debug-stack-trace`
**Цель:** Этап A фичи step-режима отладки дронов — stack-trace + подсветка строк
внутри модулей + хлебные крошки Call Stack.
Спека: [docs/superpowers/specs/2026-06-29-step-debug-stack-trace-design.md](../superpowers/specs/2026-06-29-step-debug-stack-trace-design.md)
План: [docs/superpowers/plans/2026-06-29-step-debug-stack-trace-stage-a-plan.md](../superpowers/plans/2026-06-29-step-debug-stack-trace-stage-a-plan.md)

## Итог сессии

Выполнены **Шаги 1–4** из 7. Готов весь data-layer (от воркера до стора) и
согласован визуал UI. Осталась вёрстка UI (Шаги 5–6) и E2E (Шаг 7).
Методология — строгий TDD: каждый шаг логики начинался с падающего теста.

## Коммиты

- `abd6c72` — feat: добавить mapStackToFrames и тип StackFrame (Шаг 1)
- `f79c073` — feat: заполнять codeStack кадрами вызова в CodeBehaviorDriver (Шаг 2)
- `92fc089` — feat: пробросить codeStack из Program в DroneState стора (Шаг 3)

## Что сделано

### Шаг 1 — `mapStackToFrames` + тип `StackFrame` (TDD)
`src/game/code/linker/mapLine.ts`: добавлен тип `StackFrame { programId, line }`
и функция `mapStackToFrames({ lineStack, lineMap }): StackFrame[]` — маппит
**весь** стек склеенных строк в кадры (внешний entry первым, самый глубокий —
последним), без отбрасывания модульных кадров. Выделен общий хелпер
`resolveSegment(line, lineMap)`; через него переразены и `mapLine` (добавляет
entry-фильтр), и `mapStackToEntryLine` (последний entry-кадр) — без дублирования.
5 новых тестов + 9 старых зелёные.

### Шаг 2 — `codeStack` в Program + заполнение в драйвере (TDD)
- `Program.ts`: поле `codeStack?: StackFrame[] | null`. `currentLine` остаётся
  как derived (строка последнего кадра) — источник правды теперь `codeStack`.
- `CodeBehaviorDriver.ts`: `applyStack()` заполняет `codeStack` (intent/wait) +
  derived `currentLine`; `clearStack()` сбрасывает оба в null
  (finished/error/timeout/LinkError). Старый `mapToEntryLine` удалён.
- 2 новых теста драйвера (≥2 кадра при исполнении внутри модуля; null при finished).

### Шаг 3 — проброс `codeStack` в стор
`gameStore.ts`: `DroneState.codeStack: StackFrame[] | null`, копируется в
`snapshotDrones`. `currentLine` без изменений.

### Шаг 4 — дизайн-сессия (согласован визуал крошек)
Сделана **временная dev-песочница** (`?preview=callstack`) с прототипом полосы
крошек на мок-данных (1/2/3 кадра, follow/выбранный). Пользователь оценил живьём
и **утвердил визуал**. Песочница и временная правка `main.tsx` удалены (рабочее
дерево чистое).

**Согласованный визуал `CallStackBreadcrumbs`:**
- Полоса над блоками кода: фон `#0a1628`, нижняя граница `1px solid #1e3a5f`,
  `display:flex; align-items:center; gap:4px; padding:4px 8px`.
- Крошка: формат **`имя:строка`** (напр. `harvest:5`), monospace 10px,
  `padding:2px 8px; border-radius:2px`. Имя — `registry.get(frame.programId)?.name`.
- Разделитель `▸` цветом `#445566`.
- Стили по роли (через lookup-record, без тернарников):
  - обычный кадр — `#88aacc`, фон прозрачный;
  - **активный** (самый глубокий, текущее исполнение) — `#00d4ff` на плашке `#0d2040`;
  - **выбранный кликом** — рамка `1px solid #00ff88`, цвет `#00ff88`.
- **Резерв справа** под debug-контролы этапа B (полоса НЕ на всю ширину:
  спейсер `flex:1`).

**Семантика клика (для Шага 6):**
- `selectedIndex = null` (дефолт) = **follow**: редактор автоматически следует
  за самым глубоким кадром (текущее исполнение).
- клик по крошке `i` = **pin**: редактор «прилипает» к кадру `i` (показывает его
  код + подсвечивает строку), даже пока глубже исполняется подпрограмма.
- повторный клик = снять выделение → возврат в follow (`selectedIndex = null`).
- если выбранный индекс выходит за пределы текущего стека (подпрограмма
  завершилась) — сброс в follow через `useEffect` по длине `codeStack`.
- `selectedIndex` — **внутреннее состояние, не элемент UI**; пользователь видит
  только зелёную рамку и сменившийся код редактора.

## Тесты / верификация (на момент Шага 3)
- `npm run type-check` — зелёный.
- `npm test` — 303/303 зелёные (включая новые `mapStackToFrames`, `codeStack`).

## Осталось (следующая сессия) — Шаги 5–7
- **Шаг 5:** компонент `src/ui/editor/CallStackBreadcrumbs/index.tsx` (TDD,
  testing-library + jsdom; образец теста — `ProgramCodeBlock.test.tsx`).
- **Шаг 6:** DRONE-вкладка `ProgramEditor` следует за активным кадром
  (`selectedFrameIndex` state, follow/pin, read-only превью кода модуля через
  `CodeEditor` с `readOnly`).
- **Шаг 7:** E2E `e2e/callstack.spec.ts` (образец — `subprogram-highlight.spec.ts`).
- Финал: readability-проход, `npm run test:e2e`, обновить session-doc.

## Заметки по архитектуре
- ⚠ Имя `codeStack` (не `callStack`): `Program.callStack: CallFrame[]` уже занят
  block-based исполнением.
- `mapStackToEntryLine` оставлен как fallback/совместимость (его тесты живы),
  но в драйвере больше не используется — заменён на `mapStackToFrames`.
- В `CodeEditor` `highlightLine` работает и в `readOnly`-режиме (декорации
  Monaco), так что read-only превью модуля подсветится тем же механизмом.
