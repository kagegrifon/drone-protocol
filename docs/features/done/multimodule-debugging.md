# Отладка многомодульных программ (stack trace + подсветка вызова подпрограммы)

**Статус:** done
**Spec:** [subprogram-call-highlight](../../superpowers/specs/2026-06-29-subprogram-call-highlight-design.md), [step-debug stack trace](../../superpowers/specs/2026-06-29-step-debug-stack-trace-design.md)
**Plan:** [subprogram-call-highlight](../../superpowers/plans/2026-06-29-subprogram-call-highlight.md), [step-debug stage A](../../superpowers/plans/2026-06-29-step-debug-stack-trace-stage-a-plan.md)

## Зачем

В Code Mode код дрона может импортировать подпрограммы из библиотеки. До этой фичи подсветка
текущей строки работала только для entry-программы: пока исполнение уходило в тело
импортированного модуля, подсветка гасла, а стек вызовов был не виден — отладка
многомодульных программ была «слепой».

## Поведение

- При исполнении тела импортированной подпрограммы подсвечивается активная строка в правильном
  файле (entry или модуль), а не гаснет.
- Над редактором вкладки DRONE показывается **Call Stack** — горизонтальные хлебные крошки
  кадров вызова; переход по кадрам открывает соответствующий файл.
- Код модуля при step-into показывается как read-only превью с подсветкой (редактирование
  модуля остаётся на вкладке PROGRAM).

## Критерии готовности

- `lineStack` (стек склеенных строк вызова) проходит от воркера через драйвер до UI.
- Политика маппинга «гасить в модулях» заменена на «показывать полный стек кадров».
- Call Stack рендерится крошками над редактором DRONE; навигация по кадрам работает.
- `npm test`, `npm run type-check`, `npm run test:e2e` зелёные.

## Технические заметки

> Детали дизайна — в спеках, пошаговая реализация — в планах (по ссылкам выше).

Фича сделана в две стадии. Подготовительная (subprogram-call-highlight) заложила
инфраструктуру `lineStack` в [codeRuntime.ts](../../../src/game/code/worker/codeRuntime.ts)
(`__line/__pushCall/__popCall/__call`). Stage A (step-debug stack trace) заменил политику
маппинга в [mapLine.ts](../../../src/game/code/linker/mapLine.ts) и провёл `StackFrame[]` до UI.
Движок исполнения не менялся. Стадии B (Pause/Step/Continue) и C (statement-level + breakpoints)
— возможные будущие этапы, в эту фичу не входят.

## Журнал сессий

- [2026-06-29-1900-subprogram-highlight-tasks1-3.md](../../sessions/2026-06-29-1900-subprogram-highlight-tasks1-3.md)
  — инфраструктура call-stack-маппинга (Tasks 1–3).
- [2026-06-29-2000-feat-step-debug-stack-trace-stage-a-steps1-4.md](../../sessions/2026-06-29-2000-feat-step-debug-stack-trace-stage-a-steps1-4.md)
  — Stage A, шаги 1–4.
- [2026-06-29-2030-feat-step-debug-stack-trace-stage-a-steps5-7.md](../../sessions/2026-06-29-2030-feat-step-debug-stack-trace-stage-a-steps5-7.md)
  — Stage A, шаги 5–7 (завершение, готов к merge).
