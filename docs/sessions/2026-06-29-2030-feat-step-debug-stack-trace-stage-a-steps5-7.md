# Step-debug Stack-trace (этап A) — Шаги 5–7 (UI + E2E)

**Дата:** 2026-06-29 (20:30+)
**Ветка:** `feat/step-debug-stack-trace`
**Цель:** Завершить этап A фичи step-режима отладки — UI хлебных крошек Call Stack,
follow execution на DRONE-вкладке, read-only превью кода модуля, E2E.
Спека: [docs/superpowers/specs/2026-06-29-step-debug-stack-trace-design.md](../superpowers/specs/2026-06-29-step-debug-stack-trace-design.md)
План: [docs/superpowers/plans/2026-06-29-step-debug-stack-trace-stage-a-plan.md](../superpowers/plans/2026-06-29-step-debug-stack-trace-stage-a-plan.md)
Предыдущая сессия (Шаги 1–4): [2026-06-29-2000-feat-step-debug-stack-trace-stage-a-steps1-4.md](2026-06-29-2000-feat-step-debug-stack-trace-stage-a-steps1-4.md)

## Итог сессии

Этап A **завершён**. Выполнены Шаги 5–7 строгим TDD (тест → падение → реализация).
Дополнительно починена предсуществующая регрессия в трёх чужих e2e-тестах.

## Коммиты

- `9318673` — feat: добавить компонент CallStackBreadcrumbs (Шаг 5)
- `b528ae0` — feat: DRONE-вкладка следует за активным кадром стека (Шаг 6)
- `4140258` — feat: e2e на стек вызовов и read-only превью модуля (Шаг 7)
- `dd3b53f` — fix: вернуть e2e-хелпер createProgram в LIBRARY после автоперехода на PROGRAM

## Что сделано

### Шаг 5 — `CallStackBreadcrumbs` (TDD)
`src/ui/editor/CallStackBreadcrumbs/index.tsx` + `index.test.tsx` (7 тестов,
jsdom + testing-library). Горизонтальные крошки `имя:строка`, разделитель `▸`,
роли (normal/active/selected) через lookup-record `CRUMB_ROLE_STYLE` — без
тернарников. `roleForCrumb()` — чистый хелпер с object-параметром. Клик =
`onSelectFrame(i)`. Активный кадр — `aria-current`, выбранный — `aria-selected`
(использовано в тестах). Спейсер `flex:1` справа — резерв под debug-контролы этапа B.
Имя программы: `registry.get(frame.programId)?.name ?? frame.programId` (fallback).

### Шаг 6 — DRONE-вкладка follow execution (TDD на чистой логике)
- Чистая логика выбора кадра вынесена в `frameSelection.ts` (`resolveDisplayedFrame`)
  + `frameSelection.test.ts` (4 теста: follow → глубокий кадр; pin → выбранный;
  пустой стек → null; индекс за пределами → fallback на follow).
- `ProgramEditor/index.tsx`: state `selectedFrameIndex` (null=follow). Над блоками
  кода — `<CallStackBreadcrumbs>` (только при `codeStack.length > 0`). Клик по
  крошке = toggle pin (`prev === index ? null : index`). `useEffect` сбрасывает
  pin в follow, если индекс вышел за длину стека.
- Под-компонент `ModulePreview` — read-only `CodeEditor` с кодом модуля и подсветкой
  (когда отображаемый кадр — импортированный модуль). Выбор «какой блок подсветить /
  показать ли превью модуля» вынесен в именованные значения над `return`
  (`assignedHighlightLine`, `personalHighlightLine`, `isModuleFrame`,
  `moduleFrameProgram`) — тернарники из JSX убраны. Удалён неиспользуемый
  `activeProgramId` (подсветка теперь идёт через `displayedFrame`, не `currentLine`).

### Шаг 7 — E2E `e2e/callstack.spec.ts`
Образец — `subprogram-highlight.spec.ts` (main импортирует модуль harvest).
Проверяет: во время исполнения внутри модуля видны ≥2 крошки (main ▸ harvest);
follow-режим показывает read-only код подпрограммы (`self.inventory`) с подсветкой;
клик по внешней крошке (`callstack-crumb-0`) возвращает редактор к коду main
(`import { harvest }`). Все селекторы — data-testid.

### Фикс предсуществующей регрессии (вне этапа A, по согласованию с пользователем)
Коммит `3cacf78` («автопереход на PROGRAM после создания программы») сломал e2e-хелпер
`createProgram` в `library-modules.spec.ts` (×2) и `subprogram-highlight.spec.ts`:
после `+ New` UI уже на вкладке PROGRAM, где кнопок `program-edit-btn` нет. Фикс —
вернуться в LIBRARY перед поиском кнопки edit. Тот же фикс изначально применён и в
новом `callstack.spec.ts`.

## Верификация (end-to-end)
- `npm run type-check` — зелёный.
- `npm test` — 314/314 зелёные (новые: 7 `CallStackBreadcrumbs`, 4 `frameSelection`).
- `npm run test:e2e` — 11/11 зелёные (включая новый `callstack.spec.ts` и 3 починенных).

## Заметки по архитектуре
- Подсветка строки на DRONE-вкладке теперь идёт через `displayedFrame` (кадр стека),
  а не через `drone.currentLine`. `currentLine` остаётся derived в data-layer для
  прочего UI, но вкладка DRONE им больше не пользуется.
- follow (selectedIndex=null) = редактор следует за самым глубоким кадром; pin
  (клик) = прилипнуть к кадру; повторный клик = снять (toggle).
- `ModulePreview` — отдельный read-only `CodeEditor`; редактирование модуля
  остаётся на вкладке PROGRAM (одна ответственность).

## Возможные доработки (не в этапе A)
- Этап B: debug-режим (Pause/Step into/Step over/Continue) — UI-резерв справа от
  крошек уже заложен; модель `codeStack: StackFrame[]` forward-compatible.
- Документация: спека упоминает отдельную сессию унификации debugger-UX в README/доках.
