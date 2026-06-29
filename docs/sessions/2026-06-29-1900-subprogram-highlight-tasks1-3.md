# Subprogram Call Highlight — Tasks 1–3 Session

**Date:** 2026-06-29 (19:00+)  
**Branch:** fix/highlight-importing  
**Goal:** Implement infrastructure for subprogram call line highlighting (stanza 1 of 2).

## Summary

Completed **Tasks 1–3** of the 8-task implementation plan. All tasks passed code review. The foundation for call-stack-based line mapping is now in place.

## Commits

- `b97d4a2` — feat: add lineStack to WorkerMessage intent/wait types (Task 1)
- `5e053ab` — feat: replace currentLine with lineStack in codeRuntime worker (Task 2)
- `0f82ea9` — feat: wrap __mod_* calls in __call() in instrument.ts (Task 3)
- `ddfb64c` — fix: add return after await-drone patch to prevent fallthrough (Task 3 fix)

## What Was Built

### Task 1: WorkerMessage Types
Added `lineStack: number[]` field to both `intent` and `wait` message variants in `src/game/code/types.ts`, keeping `line: number` for backward compatibility.

**Status:** ✅ Clean review (spec + quality approved)

### Task 2: Call Stack in Worker Runtime
Replaced scalar `currentLine` with stack-based line tracking in `src/game/code/worker/codeRuntime.ts`:
- `lineStack: number[] = [0]` — stack of line numbers (one frame per nesting level)
- `__line(n)` — updates current frame
- `__pushCall(callLine)` — push frame when entering subprogram
- `__popCall()` — pop frame when exiting
- `__call<T>(callLine, invoke)` — wrapper that handles both sync and async, always pops (in finally for async, immediately for sync)
- All three message types (`sendMove`, `sendAction`, `self.wait`) now send `lineStack: [...lineStack]`
- AsyncFunction receives `__call` as 4th parameter

**Status:** ✅ Clean review (spec + quality approved); 5 codeRuntime.test.ts tests fail as expected (old shape assertions — will fix in Task 6)

### Task 3: Module Call Instrumentation
Extended `src/game/code/worker/instrument.ts` to wrap ALL `__mod_*` CallExpressions in `__call(LINE, () => ...)`:
- Detects CallExpression where callee is Identifier starting with `"__mod_"`
- Wraps entire CallExpression: `__call(LINE, () => CALL)` — `await` stays outside
- Both `await __mod_foo()` and sync `__mod_foo()` are wrapped
- `await self.<action>()` still gets `;(__line(N), ...)` — unchanged
- Added 5 new test cases to `instrument.test.ts` (all pass)
- Updated `instrumentCompat.test.ts` to pass `__call` to AsyncFunction

**Initial review:** Approved; one Important finding flagged (missing `return` after await-drone patch to prevent fallthrough into children — potential future double-patching).

**Fix applied:** Added `return;` after push in await-drone branch → re-review passed clean.

**Final status:** ✅ Clean review (spec + quality approved)

## Tests

All task-level tests passing:
- `instrument.test.ts`: 15/15 ✅
- `instrumentCompat.test.ts`: 3/3 ✅
- `codeRuntime.test.ts`: 4/9 passing, 5 failing as expected (Task 6 will fix)

## Remaining Tasks (Next Session)

- **Task 4:** Add `mapStackToEntryLine(lineStack, lineMap, entryId): number | null` to `src/game/code/linker/mapLine.ts` — selects deepest entry-segment line from stack
- **Task 5:** Switch `CodeBehaviorDriver` to use `mapStackToEntryLine(msg.lineStack, ...)` instead of `mapLine(msg.line, ...)`
- **Task 6:** Update `codeRuntime.test.ts` to expect `lineStack` in sent messages
- **Task 7:** Run full test suite + manual verification in browser
- **Task 8:** Add E2E test for subprogram call highlight

## Architecture Notes

The solution follows the spec exactly:

1. **Call stack in worker** — `lineStack` is the call stack; push/pop frame when entering/exiting subprogram via `__call`
2. **Line stack in messages** — `lineStack: number[]` flows from worker to driver
3. **Smart selection at driver** — `mapStackToEntryLine` picks the deepest entry-segment line (ignores module internals)

This structure is forward-compatible with future step-debugger implementation (which will reuse the stack, just display the whole thing instead of filtering to entry-only).

## Deviations from Plan

**Task 3 implementation approach:** Implementer used a single unified patch array with a `kind` discriminator instead of two-pass approach. This is more correct — AST positions reference original source, so two separate applications would corrupt offsets. The unified approach is cleaner and correctly handles patch ordering.

## Next Session Prompt

```
Продолжаем реализацию фичи "Подсветка строки вызова подпрограммы" (спека: docs/superpowers/specs/2026-06-29-subprogram-call-highlight-design.md, план: docs/superpowers/plans/2026-06-29-subprogram-call-highlight.md).

Ветка: fix/highlight-importing

Что уже сделано (Tasks 1–3):
- Task 1 (b97d4a2): lineStack добавлен в WorkerMessage
- Task 2 (5e053ab): lineStack в codeRuntime.ts, __call добавлен
- Task 3 (ddfb64c): __mod_*-вызовы оборачиваются в __call

Прогресс-леджер: .superpowers/sdd/progress.md

Что осталось (Tasks 4–8):
- Task 4: mapStackToEntryLine в mapLine.ts + тесты
- Task 5: CodeBehaviorDriver переходит на mapStackToEntryLine
- Task 6: codeRuntime.test.ts добавить lineStack в ожидания
- Task 7: прогон всех тестов + ручная проверка
- Task 8: E2E-тест

Запусти через superpowers:subagent-driven-development, начиная с Task 4.
```

## Метрики сессии
- Модель: claude-haiku-4-5-20251001
- Input: 163 токенов (кеш: 6,241,821 / запись в кеш: 316,202)
- Output: 36,324 токенов
- Контекст: 104,523 / 200,000 токенов (52.3%)
- Стоимость: $3.604
