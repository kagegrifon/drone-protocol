# World Properties (IF function-based conditions) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить захардкоженные leaf'ы IF (`ENERGY`/`INVENTORY`/`DEPOSIT`/`DISTANCE` с фиксированной правой частью-числом и `unit: '%'`) универсальным конструктором: leaf = `FunctionCall <op> Operand`, где `Operand` — число или вложенный `FunctionCall` глубиной ≤ 1. MVP-реестр функций: `Energy`, `EnergyMax`, `Inventory`, `InventoryMax`, `Deposit`, `Distance`. Аргументы функций — `Self` или `EntityId` миссии.

**Architecture:**
- Слой данных: новые типы `ObjectRef | FunctionCall | Operand | ConditionLeaf` в `src/game/programs/types.ts`. Старые `ConditionProperty` и поле `value: number` удалены полностью (программы не персистятся, миграция не нужна).
- Реестр функций — отдельный модуль `src/game/programs/functions.ts`: `FUNCTIONS: Record<FunctionName, FunctionSpec>`. `FunctionSpec.evaluate(resolved: EntityId[], droneId, world): number | null`. Self резолвится **до** вызова `evaluate`, чтобы спеки оставались чистыми.
- Интерпретатор: `evaluateLeaf` переписан — резолв ObjectRef'ов → вызов `spec.evaluate` для left и right (если RHS — функция) → если хоть одна сторона `null` → `false`, иначе сравнение оператором.
- UI: `ConditionEditor.tsx` переписан. Вынесены `ObjectSelect.tsx` (дропдаун аргумента: `Self` + отфильтрованные `EntityMeta`) и `FunctionCallEditor.tsx` (функция + аргументы). Превью и свёрнутый IF-чип — в code-style: `Distance(Self, Mine 1) < 3 AND Inventory(Self) < InventoryMax(Self)`.
- `mission3.ts` — переписать единственный leaf вручную: `Energy% <= 30` → `Energy(Self) <= 30` (max энергии = 100, поведение идентично).

**Tech Stack:** TypeScript, React, Vitest, Playwright.

---

## File Structure

**Create:**
- `src/game/programs/functions.ts` — реестр функций (`FUNCTIONS`, типы `FunctionSpec`, помощник `resolveObjectRef`).
- `src/game/programs/functions.test.ts` — unit-тесты реестра.
- `src/ui/editor/ProgramEditor/ObjectSelect.tsx` — дропдаун аргумента (Self + entities с фильтром).
- `src/ui/editor/ProgramEditor/FunctionCallEditor.tsx` — редактор одного `FunctionCall` (функция + аргументы), используется для left и для RHS-функции.
- `src/ui/editor/ProgramEditor/conditionFormat.ts` — чистый форматтер `formatFunctionCall`, `formatLeaf`, `formatConditions` для превью и свёрнутого чипа (DRY между `ConditionEditor` и `InstructionBlock`).

**Modify:**
- `src/game/programs/types.ts` — новые типы, удалить `ConditionProperty`.
- `src/game/programs/interpreter.ts` — переписать `evaluateLeaf`.
- `src/game/programs/interpreter.test.ts` — переписать секцию `IF` под новый формат + новые кейсы (RHS-функция, `Distance = 0`).
- `src/ui/editor/ProgramEditor/ConditionEditor.tsx` — переписан под новые типы и UX.
- `src/ui/editor/ProgramEditor/InstructionBlock.tsx` — заменить `conditionChips` на code-style рендер через `formatConditions`.
- `src/ui/editor/ProgramEditor/instructionUtils.tsx` — `makeDefaultInstruction('IF', ...)` теперь возвращает leaf нового формата, если у IF есть default-условия (но текущее поведение — `conditions: []`, поэтому изменение минимальное; проверить).
- `src/game/missions/mission3.ts` — переписать leaf.
- `docs/features/planned/world-properties.md` → перенести в `docs/features/done/world-properties.md`, обновить статус.
- `docs/features/index.md` — обновить таблицы.
- `DECISIONS.md` — добавить запись.

**Test:**
- `src/game/programs/functions.test.ts` (новый).
- `src/game/programs/interpreter.test.ts` (правка).
- Существующий `regression.spec.ts` / `drone-controls.spec.ts` должны продолжать проходить (миссия 3 рендерится и стартует).

---

## Task 1: Типы данных (ConditionLeaf v2)

**Files:**
- Modify: `src/game/programs/types.ts`

Это поломает компиляцию у интерпретатора и UI — следующие задачи их чинят. Поэтому коммит этой задачи не делается отдельно; коммит — после Task 2 (интерпретатор), чтобы билд снова собирался хотя бы по simulation-слою.

- [ ] **Step 1: Удалить старый `ConditionProperty` и заменить `ConditionLeaf`**

Открой [src/game/programs/types.ts](src/game/programs/types.ts) и замени блок с `ConditionProperty` и `ConditionLeaf` (строки 6–16) на:

```ts
export type ObjectRef =
  | { kind: 'self' }
  | { kind: 'entity'; id: EntityId };

export type FunctionName =
  | 'Energy' | 'EnergyMax'
  | 'Inventory' | 'InventoryMax'
  | 'Deposit'
  | 'Distance';

export type FunctionCall =
  | { fn: 'Energy';       args: [ObjectRef] }
  | { fn: 'EnergyMax';    args: [ObjectRef] }
  | { fn: 'Inventory';    args: [ObjectRef] }
  | { fn: 'InventoryMax'; args: [ObjectRef] }
  | { fn: 'Deposit';      args: [ObjectRef] }
  | { fn: 'Distance';     args: [ObjectRef, ObjectRef] };

export type Operand =
  | { kind: 'number';   value: number }
  | { kind: 'function'; call: FunctionCall };

export type ConditionLeaf = {
  left: FunctionCall;
  operator: ConditionOperator;
  right: Operand;
};
```

Остальные типы (`ConditionOperator`, `ConditionLogic`, `ActionBlock`, …) **не трогать**. `ConditionProperty` должен исчезнуть из файла полностью.

- [ ] **Step 2: Проверить, что ничего не экспортируется случайно**

```bash
grep -n "ConditionProperty" "src/game/programs/types.ts"
```
Expected: пусто.

Коммит после Task 2.

---

## Task 2: Реестр функций + `evaluateLeaf` через реестр

### Task 2.1: Реестр функций — тесты

**Files:**
- Create: `src/game/programs/functions.test.ts`
- Create: `src/game/programs/functions.ts` (заглушка-минимум, чтобы тесты компилировались)

- [ ] **Step 1: Создать пустой `functions.ts`-скелет, чтобы импорт компилировался**

Создай `src/game/programs/functions.ts`:

```ts
import type { EntityId } from '../../shared/types/index.js';
import type { World } from '../simulation/world/World.js';
import type { FunctionName, ObjectRef, FunctionCall } from './types.js';

export interface FunctionSpec {
  name: FunctionName;
  label: string;
  icon: string;
  arity: 1 | 2;
  argLabels: string[];
  argFilter?: (entityId: EntityId, world: World) => boolean;
  evaluate: (resolved: EntityId[], droneId: EntityId, world: World) => number | null;
}

export function resolveObjectRef(ref: ObjectRef, droneId: EntityId): EntityId {
  return ref.kind === 'self' ? droneId : ref.id;
}

export function evaluateFunctionCall(call: FunctionCall, droneId: EntityId, world: World): number | null {
  const spec = FUNCTIONS[call.fn];
  const resolved = call.args.map((a) => resolveObjectRef(a, droneId));
  return spec.evaluate(resolved, droneId, world);
}

export const FUNCTIONS: Record<FunctionName, FunctionSpec> = {} as Record<FunctionName, FunctionSpec>;
```

(Объект `FUNCTIONS` пока пустой — наполним в Step 3.)

- [ ] **Step 2: Написать падающие тесты `functions.test.ts`**

Создай `src/game/programs/functions.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../simulation/world/World.js';
import { FUNCTIONS, evaluateFunctionCall, resolveObjectRef } from './functions.js';

function makeDrone(world: World, x = 0, y = 0, opts: { energy?: number; energyMax?: number; ore?: number; capacity?: number } = {}) {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Energy', { current: opts.energy ?? 50, max: opts.energyMax ?? 100, drainPerMove: 1, drainPerMine: 2 });
  world.addComponent(id, 'Inventory', { ore: opts.ore ?? 3, capacity: opts.capacity ?? 10 });
  return id;
}

function makeMine(world: World, x: number, y: number, ore: number) {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Deposit', { oreRemaining: ore, mineRate: 1 });
  return id;
}

describe('resolveObjectRef', () => {
  it('Self → droneId', () => {
    expect(resolveObjectRef({ kind: 'self' }, 42)).toBe(42);
  });
  it('entity → entity.id', () => {
    expect(resolveObjectRef({ kind: 'entity', id: 7 }, 42)).toBe(7);
  });
});

describe('FUNCTIONS — Energy / EnergyMax', () => {
  let world: World;
  beforeEach(() => { world = new World(); });

  it('Energy returns current', () => {
    const drone = makeDrone(world, 0, 0, { energy: 73 });
    expect(FUNCTIONS.Energy.evaluate([drone], drone, world)).toBe(73);
  });
  it('EnergyMax returns max', () => {
    const drone = makeDrone(world, 0, 0, { energyMax: 120 });
    expect(FUNCTIONS.EnergyMax.evaluate([drone], drone, world)).toBe(120);
  });
  it('Energy returns null for object without Energy component', () => {
    const mine = makeMine(world, 1, 1, 5);
    expect(FUNCTIONS.Energy.evaluate([mine], mine, world)).toBeNull();
  });
});

describe('FUNCTIONS — Inventory / InventoryMax', () => {
  let world: World;
  beforeEach(() => { world = new World(); });

  it('Inventory returns ore', () => {
    const drone = makeDrone(world, 0, 0, { ore: 4 });
    expect(FUNCTIONS.Inventory.evaluate([drone], drone, world)).toBe(4);
  });
  it('InventoryMax returns capacity', () => {
    const drone = makeDrone(world, 0, 0, { capacity: 15 });
    expect(FUNCTIONS.InventoryMax.evaluate([drone], drone, world)).toBe(15);
  });
  it('Inventory returns null for object without Inventory', () => {
    const mine = makeMine(world, 1, 1, 5);
    expect(FUNCTIONS.Inventory.evaluate([mine], mine, world)).toBeNull();
  });
});

describe('FUNCTIONS — Deposit', () => {
  let world: World;
  beforeEach(() => { world = new World(); });

  it('Deposit returns oreRemaining', () => {
    const mine = makeMine(world, 5, 5, 12);
    expect(FUNCTIONS.Deposit.evaluate([mine], 999, world)).toBe(12);
  });
  it('Deposit returns null for object without Deposit', () => {
    const drone = makeDrone(world);
    expect(FUNCTIONS.Deposit.evaluate([drone], drone, world)).toBeNull();
  });
});

describe('FUNCTIONS — Distance', () => {
  let world: World;
  beforeEach(() => { world = new World(); });

  it('Distance is Manhattan', () => {
    const a = makeDrone(world, 1, 2);
    const b = makeMine(world, 4, 6, 1); // |4-1|+|6-2|=7
    expect(FUNCTIONS.Distance.evaluate([a, b], a, world)).toBe(7);
  });
  it('Distance(Self, X) — Self резолвится в droneId', () => {
    const drone = makeDrone(world, 0, 0);
    const mine = makeMine(world, 3, 0, 1);
    // ObjectRef Self → resolves to drone id externally; evaluateFunctionCall covers it
    const result = evaluateFunctionCall(
      { fn: 'Distance', args: [{ kind: 'self' }, { kind: 'entity', id: mine }] },
      drone,
      world,
    );
    expect(result).toBe(3);
  });
  it('Distance returns null if any side lacks Position', () => {
    const drone = makeDrone(world);
    const ghost = world.createEntity(); // no Position
    expect(FUNCTIONS.Distance.evaluate([drone, ghost], drone, world)).toBeNull();
  });
});

describe('evaluateFunctionCall integrates Self resolution', () => {
  it('Energy(Self) reads drone energy', () => {
    const world = new World();
    const drone = makeDrone(world, 0, 0, { energy: 17 });
    expect(evaluateFunctionCall({ fn: 'Energy', args: [{ kind: 'self' }] }, drone, world)).toBe(17);
  });
});
```

- [ ] **Step 3: Запустить тесты — должны падать**

```bash
npm test -- functions.test.ts
```
Expected: FAIL (FUNCTIONS пустой).

### Task 2.2: Наполнить реестр

- [ ] **Step 1: Реализовать `FUNCTIONS` в `functions.ts`**

Замени строку `export const FUNCTIONS: Record<FunctionName, FunctionSpec> = {} as Record<FunctionName, FunctionSpec>;` в `src/game/programs/functions.ts` на:

```ts
function isEntityType(types: string[]) {
  return (id: EntityId, world: World): boolean => {
    // фильтр для UI: показываем сущности, у которых есть нужный компонент
    return types.some((t) => world.getComponent(id, t as 'Energy' | 'Inventory' | 'Deposit' | 'Position') !== undefined);
  };
}

export const FUNCTIONS: Record<FunctionName, FunctionSpec> = {
  Energy: {
    name: 'Energy', label: 'Energy', icon: '⚡',
    arity: 1, argLabels: [''],
    argFilter: isEntityType(['Energy']),
    evaluate: ([id], _droneId, world) => world.getComponent(id, 'Energy')?.current ?? null,
  },
  EnergyMax: {
    name: 'EnergyMax', label: 'EnergyMax', icon: '🔋',
    arity: 1, argLabels: [''],
    argFilter: isEntityType(['Energy']),
    evaluate: ([id], _droneId, world) => world.getComponent(id, 'Energy')?.max ?? null,
  },
  Inventory: {
    name: 'Inventory', label: 'Inventory', icon: '📦',
    arity: 1, argLabels: [''],
    argFilter: isEntityType(['Inventory']),
    evaluate: ([id], _droneId, world) => world.getComponent(id, 'Inventory')?.ore ?? null,
  },
  InventoryMax: {
    name: 'InventoryMax', label: 'InventoryMax', icon: '📦+',
    arity: 1, argLabels: [''],
    argFilter: isEntityType(['Inventory']),
    evaluate: ([id], _droneId, world) => world.getComponent(id, 'Inventory')?.capacity ?? null,
  },
  Deposit: {
    name: 'Deposit', label: 'Deposit', icon: '⛏',
    arity: 1, argLabels: [''],
    argFilter: isEntityType(['Deposit']),
    evaluate: ([id], _droneId, world) => world.getComponent(id, 'Deposit')?.oreRemaining ?? null,
  },
  Distance: {
    name: 'Distance', label: 'Distance', icon: '🛣',
    arity: 2, argLabels: ['от', 'до'],
    argFilter: isEntityType(['Position']),
    evaluate: ([a, b], _droneId, world) => {
      const pa = world.getComponent(a, 'Position');
      const pb = world.getComponent(b, 'Position');
      if (!pa || !pb) return null;
      return Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y);
    },
  },
};
```

- [ ] **Step 2: Запустить тесты функций**

```bash
npm test -- functions.test.ts
```
Expected: PASS — все 11 тестов зелёные.

### Task 2.3: Переписать `evaluateLeaf`

- [ ] **Step 1: Заменить `evaluateLeaf` в `src/game/programs/interpreter.ts`**

Открой [src/game/programs/interpreter.ts](src/game/programs/interpreter.ts), удали текущую функцию `evaluateLeaf` (строки 145–195) и замени на:

```ts
import { evaluateFunctionCall } from './functions.js';

function evaluateLeaf(leaf: ConditionLeaf, droneId: EntityId, world: World): boolean {
  const left = evaluateFunctionCall(leaf.left, droneId, world);
  const right = leaf.right.kind === 'number'
    ? leaf.right.value
    : evaluateFunctionCall(leaf.right.call, droneId, world);
  if (left === null || right === null) return false;
  switch (leaf.operator) {
    case '<':  return left < right;
    case '<=': return left <= right;
    case '=':  return left === right;
    case '>=': return left >= right;
    case '>':  return left > right;
  }
}
```

Импорт `evaluateFunctionCall` добавить в верх файла (рядом с импортом `astar`). Сам импорт `ConditionLeaf` уже есть в строке 5.

- [ ] **Step 2: Запустить unit-тесты симуляции — старые IF-тесты упадут (это ожидаемо, чиним в Task 3)**

```bash
npm test -- src/game/programs
```
Expected: `functions.test.ts` PASS; `interpreter.test.ts` — половина FAIL (старый формат leaf'ов). Это нормально.

- [ ] **Step 3: Коммит**

```bash
git add src/game/programs/types.ts src/game/programs/functions.ts src/game/programs/functions.test.ts src/game/programs/interpreter.ts
git commit -m "$(cat <<'EOF'
feat: реестр функций для IF-условий и evaluateLeaf через реестр

ConditionLeaf переписан на { left: FunctionCall, operator, right: Operand }.
Добавлен реестр FUNCTIONS с шестью MVP-функциями (Energy, EnergyMax,
Inventory, InventoryMax, Deposit, Distance). Интерпретатор использует
реестр; null от evaluate даёт false в leaf'е.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Обновить interpreter.test.ts под новый формат

**Files:**
- Modify: `src/game/programs/interpreter.test.ts`

- [ ] **Step 1: Переписать секцию `IF` (строки ~327–566)**

Замени весь блок `describe('stepProgram — IF conditions', …)` на следующий (старые кейсы сохранены по смыслу; добавлены три новых: RHS-функция, `Distance = 0`, `Inventory < InventoryMax`).

```ts
describe('stepProgram — IF conditions', () => {
  let world: World;

  beforeEach(() => { world = makeWorld(); });

  const numOp = (v: number): import('./types.js').Operand => ({ kind: 'number', value: v });
  const fnOp = (call: import('./types.js').FunctionCall): import('./types.js').Operand => ({ kind: 'function', call });
  const self = { kind: 'self' as const };

  // ── Energy ─────────────────────────────────────────────────────────────
  it('Energy(Self) < 30 is true when energy=20', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{ left: { fn: 'Energy', args: [self] }, operator: '<', right: numOp(30) }],
        operators: [],
        then: [{ type: 'CHARGE' }],
      },
    ], { energy: 20, energyMax: 100 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('charge');
  });

  it('Energy(Self) < 30 is false when energy=80', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{ left: { fn: 'Energy', args: [self] }, operator: '<', right: numOp(30) }],
        operators: [],
        then: [{ type: 'CHARGE' }],
      },
      { type: 'DROP' },
    ], { energy: 80, energyMax: 100 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('drop');
  });

  // ── Inventory < InventoryMax (RHS-функция) ─────────────────────────────
  it('Inventory(Self) < InventoryMax(Self) is true when ore=3, capacity=10', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{
          left: { fn: 'Inventory', args: [self] },
          operator: '<',
          right: fnOp({ fn: 'InventoryMax', args: [self] }),
        }],
        operators: [],
        then: [{ type: 'MINE' }],
      },
    ], { ore: 3, capacity: 10 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('mine');
  });

  it('Inventory(Self) < InventoryMax(Self) is false when ore=capacity', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{
          left: { fn: 'Inventory', args: [self] },
          operator: '<',
          right: fnOp({ fn: 'InventoryMax', args: [self] }),
        }],
        operators: [],
        then: [{ type: 'MINE' }],
      },
      { type: 'DROP' },
    ], { ore: 10, capacity: 10 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('drop');
  });

  // ── Deposit(entity) ─────────────────────────────────────────────────────
  it('Deposit(mine) = 0 is true when mine is empty', () => {
    const depId = world.createEntity();
    world.addComponent(depId, 'Position', { x: 0, y: 0 });
    world.addComponent(depId, 'Deposit', { oreRemaining: 0, mineRate: 1 });

    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{ left: { fn: 'Deposit', args: [{ kind: 'entity', id: depId }] }, operator: '=', right: numOp(0) }],
        operators: [],
        then: [{ type: 'DROP' }],
      },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('drop');
  });

  // ── Distance ────────────────────────────────────────────────────────────
  it('Distance(Self, target) <= 3 is true when target is 2 cells away', () => {
    const targetId = addTarget(world, 2, 0);
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{
          left: { fn: 'Distance', args: [self, { kind: 'entity', id: targetId }] },
          operator: '<=',
          right: numOp(3),
        }],
        operators: [],
        then: [{ type: 'MINE' }],
      },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('mine');
  });

  it('Distance(Self, target) = 0 is true when drone is on target tile', () => {
    const targetId = addTarget(world, 0, 0);  // drone at 0,0 by default
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{
          left: { fn: 'Distance', args: [self, { kind: 'entity', id: targetId }] },
          operator: '=',
          right: numOp(0),
        }],
        operators: [],
        then: [{ type: 'MINE' }],
      },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('mine');
  });

  // ── null-side gives false ───────────────────────────────────────────────
  it('Energy(non-energy-entity) gives false leaf', () => {
    const ghost = addTarget(world, 0, 0); // only Position, no Energy
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{
          left: { fn: 'Energy', args: [{ kind: 'entity', id: ghost }] },
          operator: '>=',
          right: numOp(0),
        }],
        operators: [],
        then: [{ type: 'MINE' }],
      },
      { type: 'DROP' },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('drop');
  });

  // ── AND / OR ────────────────────────────────────────────────────────────
  it('AND: true when both met', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [
          { left: { fn: 'Energy', args: [self] }, operator: '<', right: numOp(50) },
          { left: { fn: 'Inventory', args: [self] }, operator: '=', right: fnOp({ fn: 'InventoryMax', args: [self] }) },
        ],
        operators: ['AND'],
        then: [{ type: 'CHARGE' }],
      },
    ], { energy: 20, energyMax: 100, ore: 10, capacity: 10 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('charge');
  });

  it('OR: true when only second met', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [
          { left: { fn: 'Energy', args: [self] }, operator: '<', right: numOp(10) },
          { left: { fn: 'Inventory', args: [self] }, operator: '=', right: fnOp({ fn: 'InventoryMax', args: [self] }) },
        ],
        operators: ['OR'],
        then: [{ type: 'DROP' }],
      },
    ], { energy: 80, energyMax: 100, ore: 10, capacity: 10 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('drop');
  });

  it('empty conditions list evaluates to false', () => {
    const { id, registry } = addDrone(world, 'running', [
      { type: 'IF', conditions: [], operators: [], then: [{ type: 'DROP' }] },
      { type: 'MINE' },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('mine');
  });

  it('executes else-body when condition is false', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{
          left: { fn: 'Inventory', args: [self] },
          operator: '=',
          right: fnOp({ fn: 'InventoryMax', args: [self] }),
        }],
        operators: [],
        then: [{ type: 'DROP' }],
        else: [{ type: 'MINE' }],
      },
    ], { ore: 3, capacity: 10 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('mine');
  });
});
```

- [ ] **Step 2: Запустить тесты**

```bash
npm test -- src/game/programs
```
Expected: PASS — все тесты `interpreter.test.ts` и `functions.test.ts` зелёные.

- [ ] **Step 3: Коммит**

```bash
git add src/game/programs/interpreter.test.ts
git commit -m "$(cat <<'EOF'
test: переписать IF-тесты интерпретатора под новый формат leaf

Покрывает Energy/Inventory/Deposit/Distance с ObjectRef'ами, RHS-функцию
(Inventory < InventoryMax), Distance = 0, null-side → false-leaf.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Обновить mission3.ts

**Files:**
- Modify: `src/game/missions/mission3.ts`

Это нужно сделать сейчас, чтобы остальной билд (UI) при сборке мог опираться на корректный формат во встроенных миссиях. Без правки `mission3.ts` `tsc` упадёт.

- [ ] **Step 1: Заменить leaf миссии 3**

В [src/game/missions/mission3.ts](src/game/missions/mission3.ts) замени блок строк 51–58 (старый `IF` leaf) на:

```ts
            {
              type: "IF",
              conditions: [
                {
                  left: { fn: "Energy", args: [{ kind: "self" }] },
                  operator: "<=",
                  right: { kind: "number", value: 30 },
                },
              ],
              operators: [],
              then: [
                { type: "MOVE_TO", targetEntityId: charger1Id },
                { type: "CHARGE" },
              ],
            },
```

(Порог `30` корректен: исходный был `Energy% <= 30` при `Energy.max = 100`, что эквивалентно `Energy(Self) <= 30`. Поведение демо-программы не меняется.)

- [ ] **Step 2: Проверить миссии 1/2/4 — есть ли в них IF**

```bash
grep -l "kind:.*ENERGY\|kind:.*INVENTORY\|kind:.*DEPOSIT\|kind:.*DISTANCE" "src/game/missions"
```
Expected: только `mission3.ts` уже исправлен — других совпадений быть не должно. Если есть — править аналогично.

- [ ] **Step 3: Type-check simulation-слоя**

```bash
npm run type-check
```
Expected: ошибки **только** в UI (`ConditionEditor.tsx`, `InstructionBlock.tsx`) — simulation/missions компилируются.

(Коммит — после Task 5, чтобы UI тоже билдился.)

---

## Task 5: UI — форматтер и вспомогательные компоненты

### Task 5.1: `conditionFormat.ts` (чистый форматтер для превью и чипа)

**Files:**
- Create: `src/ui/editor/ProgramEditor/conditionFormat.ts`

- [ ] **Step 1: Создать форматтер**

```ts
import type { ConditionLeaf, ConditionLogic, FunctionCall, ObjectRef, Operand } from '../../../game/programs/types.js';
import type { EntityMeta } from '../../../game/missions/types.js';

export function formatObjectRef(ref: ObjectRef, entities: EntityMeta[]): string {
  if (ref.kind === 'self') return 'Self';
  return entities.find((e) => e.id === ref.id)?.label ?? `#${ref.id}`;
}

export function formatFunctionCall(call: FunctionCall, entities: EntityMeta[], compact = false): string {
  const sep = compact ? ',' : ', ';
  const args = call.args.map((a) => formatObjectRef(a, entities)).join(sep);
  return `${call.fn}(${args})`;
}

export function formatOperand(op: Operand, entities: EntityMeta[], compact = false): string {
  return op.kind === 'number' ? String(op.value) : formatFunctionCall(op.call, entities, compact);
}

export function formatLeaf(leaf: ConditionLeaf, entities: EntityMeta[], compact = false): string {
  const space = compact ? '' : ' ';
  return `${formatFunctionCall(leaf.left, entities, compact)}${space}${leaf.operator}${space}${formatOperand(leaf.right, entities, compact)}`;
}

export function formatConditions(conditions: ConditionLeaf[], operators: ConditionLogic[], entities: EntityMeta[], compact = false): string {
  if (conditions.length === 0) return '(нет условий)';
  const sep = compact ? ' ' : ' ';
  return conditions
    .map((c, i) => {
      const leaf = formatLeaf(c, entities, compact);
      return i === 0 ? leaf : `${operators[i - 1]}${sep}${leaf}`;
    })
    .join(sep);
}
```

### Task 5.2: `ObjectSelect.tsx`

**Files:**
- Create: `src/ui/editor/ProgramEditor/ObjectSelect.tsx`

- [ ] **Step 1: Создать компонент**

```tsx
import type { ObjectRef } from '../../../game/programs/types.js';
import type { EntityMeta } from '../../../game/missions/types.js';

const selectStyle: React.CSSProperties = {
  background: '#0a1628',
  border: '1px solid #1e3a5f',
  color: '#aabbcc',
  fontFamily: 'monospace',
  fontSize: '11px',
  padding: '2px 4px',
  borderRadius: '2px',
};

interface Props {
  value: ObjectRef;
  entities: EntityMeta[];
  // Фильтр по типу — например, для Deposit показываем только Mine'ы.
  // Получает EntityMeta, возвращает true, если опция допустима.
  filter?: (entity: EntityMeta) => boolean;
  label?: string;
  onChange: (next: ObjectRef) => void;
}

export function ObjectSelect({ value, entities, filter, label, onChange }: Props) {
  const filtered = filter ? entities.filter(filter) : entities;
  const stringValue = value.kind === 'self' ? '__self__' : String(value.id);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
      {label && <span style={{ color: '#445566', fontFamily: 'monospace', fontSize: '10px' }}>{label}:</span>}
      <select
        style={selectStyle}
        value={stringValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '__self__') onChange({ kind: 'self' });
          else onChange({ kind: 'entity', id: Number(v) });
        }}
      >
        <option value="__self__">Self</option>
        {filtered.map(({ id, label: l }) => (
          <option key={id} value={id}>{l}</option>
        ))}
      </select>
    </span>
  );
}
```

### Task 5.3: `FunctionCallEditor.tsx`

**Files:**
- Create: `src/ui/editor/ProgramEditor/FunctionCallEditor.tsx`

- [ ] **Step 1: Создать компонент**

```tsx
import type { FunctionCall, FunctionName, ObjectRef } from '../../../game/programs/types.js';
import type { EntityMeta } from '../../../game/missions/types.js';
import { FUNCTIONS } from '../../../game/programs/functions.js';
import { ObjectSelect } from './ObjectSelect.js';

const FUNCTION_ORDER: FunctionName[] = ['Energy', 'EnergyMax', 'Inventory', 'InventoryMax', 'Deposit', 'Distance'];

const selectStyle: React.CSSProperties = {
  background: '#0a1628',
  border: '1px solid #1e3a5f',
  color: '#aabbcc',
  fontFamily: 'monospace',
  fontSize: '11px',
  padding: '2px 4px',
  borderRadius: '2px',
};

function defaultCallForFn(fn: FunctionName): FunctionCall {
  const self: ObjectRef = { kind: 'self' };
  if (fn === 'Distance') return { fn: 'Distance', args: [self, self] };
  return { fn, args: [self] } as FunctionCall;
}

interface Props {
  value: FunctionCall;
  entities: EntityMeta[];
  onChange: (next: FunctionCall) => void;
}

export function FunctionCallEditor({ value, entities, onChange }: Props) {
  const spec = FUNCTIONS[value.fn];

  function setFn(fn: FunctionName) {
    onChange(defaultCallForFn(fn));
  }

  function setArg(index: number, ref: ObjectRef) {
    const args = [...value.args] as ObjectRef[];
    args[index] = ref;
    onChange({ ...value, args } as FunctionCall);
  }

  // Фильтр опций аргумента: argFilter из спеки применяется к EntityId.
  const argFilter = spec.argFilter
    ? (e: EntityMeta) => spec.argFilter!(e.id, /* world не нужен — фильтр UI работает по entities метам;
        внутри argFilter мы передаём world через замыкание не можем — поэтому
        UI-фильтр выражаем напрямую через тип EntityMeta */ null as never)
    : undefined;

  // Поскольку argFilter ожидает World, а в UI его нет, заменяем на статический фильтр по типам:
  const typeFilter: ((e: EntityMeta) => boolean) | undefined = (() => {
    switch (value.fn) {
      case 'Energy':
      case 'EnergyMax':
      case 'Inventory':
      case 'InventoryMax':
        return undefined; // дроны не появляются как EntityMeta — фильтр сужает до пустоты; оставляем Self + все entities (игрок поймёт через runtime null→false)
      case 'Deposit':
        return (e) => e.type === 'mine';
      case 'Distance':
        return undefined; // любая сущность с Position
    }
  })();

  void argFilter;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
      <select
        style={selectStyle}
        value={value.fn}
        onChange={(e) => setFn(e.target.value as FunctionName)}
      >
        {FUNCTION_ORDER.map((name) => (
          <option key={name} value={name}>{FUNCTIONS[name].icon} {FUNCTIONS[name].label}</option>
        ))}
      </select>
      <span style={{ color: '#445566' }}>(</span>
      {value.args.map((arg, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          {i > 0 && <span style={{ color: '#445566' }}>,</span>}
          <ObjectSelect
            value={arg}
            entities={entities}
            filter={typeFilter}
            label={spec.argLabels[i] || undefined}
            onChange={(next) => setArg(i, next)}
          />
        </span>
      ))}
      <span style={{ color: '#445566' }}>)</span>
    </span>
  );
}
```

(Комментарии в коде выше — однострочные ориентиры, не докстринги. Они объясняют, почему UI-фильтр статический.)

---

## Task 6: Переписать `ConditionEditor.tsx`

**Files:**
- Modify: `src/ui/editor/ProgramEditor/ConditionEditor.tsx`

- [ ] **Step 1: Полная замена содержимого файла**

Замени весь файл на:

```tsx
import { useState } from 'react';
import type { ConditionLeaf, ConditionLogic, ConditionOperator, FunctionCall, Operand } from '../../../game/programs/types.js';
import type { EntityMeta } from '../../../game/missions/types.js';
import { FunctionCallEditor } from './FunctionCallEditor.js';
import { formatConditions } from './conditionFormat.js';

interface Props {
  conditions: ConditionLeaf[];
  operators: ConditionLogic[];
  entities: EntityMeta[];
  onSave: (conditions: ConditionLeaf[], operators: ConditionLogic[]) => void;
  onCancel: () => void;
}

const OPERATORS: ConditionOperator[] = ['<', '<=', '=', '>=', '>'];

function defaultLeaf(): ConditionLeaf {
  return {
    left: { fn: 'Energy', args: [{ kind: 'self' }] },
    operator: '<',
    right: { kind: 'number', value: 50 },
  };
}

const selectStyle: React.CSSProperties = {
  background: '#0a1628',
  border: '1px solid #1e3a5f',
  color: '#aabbcc',
  fontFamily: 'monospace',
  fontSize: '11px',
  padding: '2px 4px',
  borderRadius: '2px',
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
  width: '52px',
};

export function ConditionEditor({ conditions: initConditions, operators: initOperators, entities, onSave, onCancel }: Props) {
  const [conditions, setConditions] = useState<ConditionLeaf[]>(initConditions.length > 0 ? initConditions : [defaultLeaf()]);
  const [operators, setOperators] = useState<ConditionLogic[]>(initOperators);

  function updateCondition(index: number, updated: ConditionLeaf) {
    setConditions((prev) => prev.map((c, i) => (i === index ? updated : c)));
  }

  function removeCondition(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index));
    setOperators((prev) => {
      const next = [...prev];
      next.splice(index === 0 ? 0 : index - 1, 1);
      return next;
    });
  }

  function addCondition() {
    setConditions((prev) => [...prev, defaultLeaf()]);
    setOperators((prev) => [...prev, 'AND']);
  }

  function toggleOperator(index: number) {
    setOperators((prev) => prev.map((op, i) => (i === index ? (op === 'AND' ? 'OR' : 'AND') : op)));
  }

  return (
    <div style={{ marginTop: '6px', padding: '10px', background: '#060f1e', border: '1px solid #1e3a5f', borderRadius: '4px' }}>
      <div style={{ color: '#445566', fontFamily: 'monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
        ⚙️ Условие IF
      </div>

      {conditions.map((leaf, index) => (
        <div key={index}>
          <ConditionRow
            leaf={leaf}
            entities={entities}
            onChange={(updated) => updateCondition(index, updated)}
            onRemove={() => removeCondition(index)}
          />
          {index < operators.length && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
              <div style={{ flex: 1, height: '1px', background: '#1e3a5f' }} />
              <button
                onClick={() => toggleOperator(index)}
                style={{ background: '#0a1628', border: '1px solid #1e3a5f', color: '#00d4ff', fontFamily: 'monospace', fontSize: '10px', padding: '1px 8px', borderRadius: '2px', cursor: 'pointer' }}
              >
                {operators[index]}
              </button>
              <div style={{ flex: 1, height: '1px', background: '#1e3a5f' }} />
            </div>
          )}
        </div>
      ))}

      <button
        onClick={addCondition}
        style={{ background: 'none', border: '1px dashed #1e3a5f', color: '#445566', fontFamily: 'monospace', fontSize: '11px', padding: '3px 10px', borderRadius: '3px', cursor: 'pointer', width: '100%', marginTop: '6px', marginBottom: '8px' }}
      >
        + добавить условие
      </button>

      <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4488ff', background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: '2px', padding: '4px 8px', marginBottom: '8px' }}>
        👁 {formatConditions(conditions, operators, entities)}
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => onSave(conditions, operators)}
          style={{ flex: 1, background: '#0a2a0a', border: '1px solid #1a5f1a', color: '#4caf50', fontFamily: 'monospace', fontSize: '11px', padding: '4px', borderRadius: '3px', cursor: 'pointer' }}
        >
          Сохранить
        </button>
        <button
          onClick={onCancel}
          style={{ flex: 1, background: '#0a1628', border: '1px solid #1e3a5f', color: '#445566', fontFamily: 'monospace', fontSize: '11px', padding: '4px', borderRadius: '3px', cursor: 'pointer' }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

function ConditionRow({
  leaf,
  entities,
  onChange,
  onRemove,
}: {
  leaf: ConditionLeaf;
  entities: EntityMeta[];
  onChange: (updated: ConditionLeaf) => void;
  onRemove: () => void;
}) {
  function setLeft(left: FunctionCall) {
    onChange({ ...leaf, left });
  }
  function setRight(right: Operand) {
    onChange({ ...leaf, right });
  }
  function setOperator(operator: ConditionOperator) {
    onChange({ ...leaf, operator });
  }
  function setRightKind(kind: 'number' | 'function') {
    if (kind === leaf.right.kind) return;
    if (kind === 'number') setRight({ kind: 'number', value: 0 });
    else setRight({ kind: 'function', call: { fn: 'Energy', args: [{ kind: 'self' }] } });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', flexWrap: 'wrap' }}>
      <FunctionCallEditor value={leaf.left} entities={entities} onChange={setLeft} />

      <select
        style={{ ...selectStyle, width: '40px' }}
        value={leaf.operator}
        onChange={(e) => setOperator(e.target.value as ConditionOperator)}
      >
        {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
      </select>

      <select
        style={selectStyle}
        value={leaf.right.kind}
        onChange={(e) => setRightKind(e.target.value as 'number' | 'function')}
      >
        <option value="number">число</option>
        <option value="function">функция</option>
      </select>

      {leaf.right.kind === 'number' ? (
        <input
          type="number"
          style={inputStyle}
          value={leaf.right.value}
          onChange={(e) => setRight({ kind: 'number', value: Number(e.target.value) })}
        />
      ) : (
        <FunctionCallEditor
          value={leaf.right.call}
          entities={entities}
          onChange={(call) => setRight({ kind: 'function', call })}
        />
      )}

      <button
        onClick={onRemove}
        style={{ background: 'none', border: 'none', color: '#445566', cursor: 'pointer', fontSize: '14px', padding: '0 2px', lineHeight: 1, marginLeft: 'auto' }}
        title="Удалить"
      >
        ×
      </button>
    </div>
  );
}
```

---

## Task 7: Code-style рендер свёрнутого IF в `InstructionBlock.tsx`

**Files:**
- Modify: `src/ui/editor/ProgramEditor/InstructionBlock.tsx`

- [ ] **Step 1: Заменить `conditionChips` на единый code-style лейбл**

Открой [src/ui/editor/ProgramEditor/InstructionBlock.tsx](src/ui/editor/ProgramEditor/InstructionBlock.tsx).

Удали функцию `conditionChips` (строки 19–39) и функцию `opSymbol` (строки 13–17) — они больше не нужны.

Замени импорт `import type { Instruction, FlowBlock, ConditionBlock, ConditionLeaf, ConditionLogic } from '../../../game/programs/types.js';` на:

```tsx
import type { Instruction, FlowBlock, ConditionLeaf, ConditionLogic } from '../../../game/programs/types.js';
import { formatConditions } from './conditionFormat.js';
```

В рендере IF-блока (строки 117–161, замыкание `instruction.type === 'IF' && (() => { … })()`) замени content так, чтобы вместо chips выводилась одна code-style строка:

```tsx
        {instruction.type === 'IF' && (() => {
          const noConditions = instruction.conditions.length === 0;
          const label = noConditions
            ? null
            : formatConditions(instruction.conditions, instruction.operators, entities, /* compact */ true);
          return (
            <>
              {noConditions
                ? <span style={{ color: '#ff8844', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>условие не задано</span>
                : (
                    <span
                      style={{
                        background: '#0a2040',
                        color: '#4488ff',
                        fontFamily: 'monospace',
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        border: '1px solid #1e3a5f',
                      }}
                    >
                      {label}
                    </span>
                  )
              }
              <button
                onClick={() => setEditorOpen((o) => !o)}
                style={{
                  background: 'none',
                  border: '1px solid #1e3a5f',
                  color: '#445566',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                {noConditions ? '✏️ задать' : '✏️'}
              </button>
            </>
          );
        })()}
```

Тип `ConditionBlock` больше не импортируется — это нормально (он использовался только в `conditionChips`).

- [ ] **Step 2: Type-check всей кодовой базы**

```bash
npm run type-check
```
Expected: PASS — без ошибок.

- [ ] **Step 3: Запустить юнит-тесты**

```bash
npm test
```
Expected: PASS — все тесты зелёные.

- [ ] **Step 4: Коммит**

```bash
git add src/game/missions/mission3.ts src/ui/editor/ProgramEditor/conditionFormat.ts src/ui/editor/ProgramEditor/ObjectSelect.tsx src/ui/editor/ProgramEditor/FunctionCallEditor.tsx src/ui/editor/ProgramEditor/ConditionEditor.tsx src/ui/editor/ProgramEditor/InstructionBlock.tsx
git commit -m "$(cat <<'EOF'
feat: редактор IF-условий через вызовы функций реестра

ConditionEditor переписан под новую модель leaf'а: FunctionCallEditor
для left/right, переключатель «число / функция» для RHS, code-style
превью и свёрнутый чип IF. mission3 leaf переведён на Energy(Self) <= 30.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: E2E-проверка миссии 3 и общая регрессия

**Files:** (без правок кода — только запуск)

- [ ] **Step 1: Запустить полный E2E**

```bash
npm run test:e2e
```
Expected: PASS — текущие сценарии (`regression.spec.ts`, `drone-controls.spec.ts`, `move-to-picker.spec.ts`, `debug.spec.ts`) проходят. Миссия 3 стартует без console-ошибок (см. `regression.spec.ts:49`).

- [ ] **Step 2: Если падает — откатиться к диагностике**

Если e2e падает с ошибкой рендера IF в миссии 3 — это значит, что `formatConditions` или `FunctionCallEditor` бросают исключение при первом рендере. Проверь:
- `mission3.ts` использует именно новые ключи (`left`, `right`, `operator`), а не старые `property/value`.
- В UI игрок не открывал редактор условий — проверка касается только свёрнутого вида.

Любые правки фиксировать отдельным `fix:` коммитом.

---

## Task 9: Документация и закрытие фичи

**Files:**
- Move: `docs/features/planned/world-properties.md` → `docs/features/done/world-properties.md`
- Modify: `docs/features/index.md`
- Modify: `DECISIONS.md`
- Create: `docs/sessions/<datetime>-feature-world-properties.md`

- [ ] **Step 1: Перенести файл фичи**

```bash
git mv "docs/features/planned/world-properties.md" "docs/features/done/world-properties.md"
```

Затем в перенесённом файле замени строку `**Статус:** planned` на `**Статус:** done` и отметь все чек-боксы критериев готовности `[ ]` → `[x]`.

- [ ] **Step 2: Обновить `docs/features/index.md`**

В таблице **planned** удалить строку `world-properties.md`. В таблицу **done** добавить:

```
| [world-properties.md](done/world-properties.md) | Свойства объектов мира в условиях IF |
```

- [ ] **Step 3: Добавить запись в `DECISIONS.md`**

В разделе «Архитектура», над текущей верхней записью «Действия дронов атомарны», добавь:

```
**[25-05-2026] Условие IF строится из вызовов функций реестра, не из захардкоженных kind** — leaf теперь `FunctionCall <op> Operand`, где `Operand` — число или вложенный `FunctionCall` глубиной 1. Шесть MVP-функций (`Energy`, `EnergyMax`, `Inventory`, `InventoryMax`, `Deposit`, `Distance`) живут в `src/game/programs/functions.ts`; новая функция добавляется одной записью в реестр, UI подхватывает автоматически. Альтернатива «расширять `ConditionProperty.kind` под каждый кейс» отвергнута: она требовала бы хардкодить пары «свойство × сравниваемое поле» (например, отдельный `INVENTORY_NOT_FULL`) и не давала бы `Distance = 0` или `Inventory < InventoryMax`. Аргумент функции — `Self` или конкретная сущность миссии; `null` от `evaluate` → leaf `false`.
```

- [ ] **Step 4: Создать запись сессии**

Создай `docs/sessions/2026-05-25-feat-world-properties.md`:

```md
# 2026-05-25 — Свойства объектов мира в условиях IF

## Цель

Реализовать фичу [world-properties](../features/done/world-properties.md):
универсальный конструктор условий IF через встроенные функции
(`Energy`, `EnergyMax`, `Inventory`, `InventoryMax`, `Deposit`, `Distance`).

## Результаты

- `ConditionLeaf` переписан на `{ left, operator, right }`; `ObjectRef`/`FunctionCall`/`Operand` добавлены в `src/game/programs/types.ts`.
- Реестр функций в `src/game/programs/functions.ts`, юнит-тесты `functions.test.ts`.
- `interpreter.ts → evaluateLeaf` использует реестр; null → false.
- UI: `ConditionEditor.tsx` переписан под новую модель; вынесены `ObjectSelect.tsx`, `FunctionCallEditor.tsx`, `conditionFormat.ts`. Свёрнутый IF-чип и превью — в code-style.
- `mission3.ts`: leaf `Energy% <= 30` → `Energy(Self) <= 30` (поведение идентично).
- `DECISIONS.md` обновлён.
- `npm run type-check`, `npm test`, `npm run test:e2e` зелёные.
```

- [ ] **Step 5: Финальный коммит**

```bash
git add docs/features docs/sessions DECISIONS.md
git commit -m "$(cat <<'EOF'
docs: world-properties — перенос фичи в done и запись решения

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review checklist

**Spec coverage** (см. чек-лист «Критерии готовности» в [docs/features/planned/world-properties.md](../features/planned/world-properties.md)):
- ConditionLeaf переписан, старые типы удалены → Task 1.
- ObjectRef добавлен → Task 1.
- Реестр FUNCTIONS с 6 MVP → Task 2.2.
- evaluateLeaf через реестр, Self→droneId, null→false → Task 2.3.
- ConditionEditor переписан под дропдауны функции/аргументов и переключатель RHS → Task 6.
- ObjectSelect и FunctionCallEditor вынесены → Task 5.
- Превью и свёрнутый чип в code-style → Tasks 5.1 / 7.
- mission3 обновлён → Task 4.
- functions.test.ts покрывает каждую функцию + Self + null → Task 2.1.
- interpreter.test.ts обновлён + RHS-функция + Distance=0 → Task 3.
- E2E зелёный → Task 8.
- type-check/test/e2e зелёные → Task 7 (step 2-3) + Task 8.
- DECISIONS.md запись → Task 9.

**Placeholder scan:** проверено — все шаги содержат готовый код или конкретные команды.

**Type consistency:**
- `FunctionName`, `ObjectRef`, `FunctionCall`, `Operand`, `ConditionLeaf` — единые имена в типах (Task 1), реестре (Task 2), интерпретаторе (Task 2.3), форматтере (Task 5.1) и UI (Task 5.2/5.3/6).
- `evaluateFunctionCall(call, droneId, world)` — единая сигнатура: используется в `interpreter.ts` и в тесте функций.
- `FunctionSpec.evaluate(resolved: EntityId[], droneId, world)` — резолв Self делается в `evaluateFunctionCall` (Task 2.1), спеки принимают уже резолвленные id (Task 2.2 + тест Task 2.1).
- `formatConditions(..., compact?: boolean)` — единая сигнатура, вызывается из ConditionEditor (без compact) и InstructionBlock (compact=true).
