# 2026-05-26 — Свойства объектов мира в условиях IF

## Цель

Реализовать фичу [world-properties](../features/done/world-properties.md):
универсальный конструктор условий IF через встроенные функции
(`Energy`, `EnergyMax`, `Inventory`, `InventoryMax`, `Deposit`, `Distance`).

## Результаты

- `ConditionLeaf` переписан на `{ left, operator, right }`; `ObjectRef`/`FunctionCall`/`Operand` добавлены в `src/game/programs/types.ts`.
- Реестр функций в `src/game/programs/functions.ts`, юнит-тесты `functions.test.ts` (14 кейсов).
- `interpreter.ts → evaluateLeaf` использует реестр; null → false.
- UI: `ConditionEditor.tsx` переписан под новую модель; вынесены `ObjectSelect.tsx`, `FunctionCallEditor.tsx`, `conditionFormat.ts`. Свёрнутый IF-чип и превью — в code-style.
- `mission3.ts`: leaf `Energy% <= 30` → `Energy(Self) <= 30` (поведение идентично).
- `DECISIONS.md` обновлён.
- `npm run type-check`, `npm test` (154 теста), `npm run test:e2e` (8 тестов) зелёные.
