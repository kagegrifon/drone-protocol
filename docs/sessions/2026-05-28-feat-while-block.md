# Session: feat — блок WHILE

**Дата:** 2026-05-28

## Цель

Добавить управляющий блок `WHILE (условие) { тело }` в систему программ дронов.

## Результат

Реализован полный стек WHILE: тип, интерпретатор, UI-редактор, тесты.

### Изменённые файлы

| Файл | Что сделано |
|------|-------------|
| `src/game/programs/types.ts` | Добавлен тип `WHILE` в `FlowBlock` |
| `src/game/simulation/components/Program.ts` | `CallFrame` расширен полями `whileConditions/whileOperators` |
| `src/game/programs/interpreter.ts` | `case 'WHILE'` + переоценка условия при исчерпании тела |
| `src/ui/editor/ProgramEditor/instructionUtils.tsx` | WHILE в `NEW_INSTRUCTION_TYPES` и `makeDefaultInstruction` |
| `src/ui/editor/ProgramEditor/InstructionBlock.tsx` | Иконка `↺`, badge условия, кнопка редактора, вложенное тело |
| `src/ui/editor/ProgramEditor/index.tsx` | `getInstructionByPath` учитывает WHILE |
| `src/shared/store/gameStore.ts` | `describeInstruction` и `getInstructionList` |
| `src/game/programs/interpreter.test.ts` | 5 новых тестов WHILE |

### Ключевые решения

- Условие хранится в `CallFrame` (`whileConditions/whileOperators`), чтобы переоценивать его на каждой итерации без доступа к родительскому фрейму.
- При исчерпании тела: если условие ещё `true` → `instructionIndex = 0` (повтор); если `false` → стандартный pop + advance родителя.
- Родительский `instructionIndex` не инкрементируется при push'е дочернего фрейма — тот же паттерн, что у `LOOP` и `IF`.
- UI WHILE полностью переиспользует `ConditionEditor` и `formatConditions` от `IF`.

## Тесты

399 unit-тестов — все зелёные. Type-check чистый.
