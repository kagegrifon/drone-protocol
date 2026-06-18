# Session: Refactor park-block-logic

**Date:** 2026-06-18  
**Goal:** Remove block-based programming logic from Drone Loop, keep only code-form `{ sourceForm: "code"; code: string }`  
**Branch:** `refactor/exclude-block-logic`  
**Status:** Unit tests fixed ✅ | E2E tests pending 🔄

## Completed

### Migration
- User performed the migration manually (type refactoring, file deletions, simplifications)
- All block-related types, files, and logic removed from active code
- Git tag `block-logic-archive` created at `9ccfd190e401853a445e9010fe9f85c70a3fb55b` (restoration point)

### Fixed Test Failures (Unit)

**176 unit tests passing** across 21 test files. Fixed:

1. **`functions.ts` + `functions.test.ts`** — deleted (dead code, only used by `AstBehaviorDriver`)
2. **`Program.ts`** — removed imports `ConditionLeaf`/`ConditionLogic` and fields `whileConditions`/`whileOperators`
3. **`CodeBehaviorDriver.ts`** — updated import of `planAstarMove` from new `src/game/pathfinding/planMove.ts`
4. **`src/game/pathfinding/planMove.ts`** — created, restored `planAstarMove` utility (was in deleted `interpreter.ts`)
5. **`gameStore.ts`** — removed unconditional personal program code wipe in `init()`, simplified `filterPrograms`
6. **`App.tsx`** — removed `entities` prop from `<ProgramEditor />`
7. **`missions.test.ts`** — converted block structure checks to smoke checks (code-form only)
8. **`ProgramExecutionSystem.test.ts`** — removed block-based MINE/DROP/MOVE_TO tests, kept management logic + 1 CodeBehaviorDriver test
9. **`atomic-actions.integration.test.ts`** — deleted (coverage already in `MiningSystem.test.ts`)
10. **`gameStore.test.ts`** — removed block-related suites, converted all block literals to code form

### Verification
- `npm run type-check` — clean
- `npm test` — 176 passed
- `grep` confirms no `Instruction`/`stepProgram`/`AstBehaviorDriver`/`sourceForm === "block"` in active code

## Pending

### E2E Test Failures (5 tests)

1. **`e2e/code-mode.spec.ts:55`** — `enableCodeMode()` clicks removed `[data-testid="code-mode-toggle-code"]` (codeModeEnabled fully removed)
2. **`e2e/move-to-picker.spec.ts:16`** — tests `[data-testid="move-to-toggle"]` from deleted `InstructionBlock.tsx` (block UI removed)
3. **`e2e/drone-controls.spec.ts:30`** — per-drone pause/start test (unknown cause)
4. **`e2e/drone-controls.spec.ts:69`** — per-drone reset test (unknown cause)
5. **`e2e/drone-controls.spec.ts:88`** — DroneList button selection test (unknown cause)

**Next session:** Run `npm run test:e2e`, diagnose, and fix all 5 tests. Likely fixes:
- Remove `enableCodeMode()` or delete test (code-mode.spec.ts)
- Delete test (move-to-picker.spec.ts, block UI gone)
- Diagnose drone-controls tests by error message

## Technical Details

### Key Changes

**Deleted files:**
- `src/game/programs/interpreter.ts` + `.test.ts`
- `src/game/code/AstBehaviorDriver.ts` + `.test.ts`
- `src/game/code/equivalence.test.ts`
- `src/ui/editor/ProgramEditor/InstructionBlock.tsx`, `DropSlot.tsx`, `ConditionEditor.tsx`, `conditionFormat.ts`, `FunctionCallEditor.tsx`, `ObjectSelect.tsx`, `instructionUtils.tsx`
- `src/game/programs/functions.ts` + `.test.ts`
- `src/game/simulation/atomic-actions.integration.test.ts`

**Created:**
- `src/game/pathfinding/planMove.ts` (utility extracted from interpreter)

**Modified:**
- `src/game/programs/types.ts` — flattened `DroneBehavior` to code-only
- `src/game/programs/index.ts` — updated re-exports
- `src/shared/store/gameStore.ts` — removed block methods, simplified store logic
- `src/ui/editor/ProgramEditor/index.tsx` — always code-form, no DnD
- `src/game/simulation/systems/ProgramExecutionSystem.ts` — always `codeDriver`
- `src/ui/modals/AudioSettingsModal.tsx` — block toggle disabled
- `src/App.tsx` — `ProgramEditor` no props
- Missions 1–4, test files — converted to code-form

### Architecture Impact

- **Data flow:** simplified to code-only path
- **Driver selection:** always `CodeBehaviorDriver` (block `AstBehaviorDriver` removed)
- **UI:** `ProgramEditor` only shows `CodeEditor` (no DnD/block UI)
- **Feature flag:** `codeModeEnabled` removed entirely (was placeholder only)

## Restoration

To restore block logic:
```bash
git checkout block-logic-archive -- <files>
# or restore entire state from tag
git show block-logic-archive:src/game/programs/interpreter.ts
```

See plan: [docs/features/planned/park-block-logic.md](docs/features/planned/park-block-logic.md)

## Метрики сессии
- Модель: claude-haiku-4-5-20251001
- Input: 32,916 токенов (кеш: 16,320,087 / запись в кеш: 1,158,208)
- Output: 119,569 токенов
- Контекст: 52,658 / 200,000 токенов (26.3%)
- Стоимость: $11.132
