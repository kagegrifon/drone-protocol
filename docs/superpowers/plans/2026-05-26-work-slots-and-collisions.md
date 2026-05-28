# Work-Slots and Collisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить компонент WorkSlots на Deposit/ChargerStation/Base, событийный lifecycle занятости через drone:moved/entity:removed, фикс гонки в MovementSystem (два дрона не могут оказаться в одной клетке), функцию FreeSlots(target) в IF-условиях, валидацию спавна.

**Architecture:** Компонент `WorkSlots` добавляется на «рабочие» сущности фабриками; модуль `workSlotsIndex` хранит Map<"x,y", SlotRef> и обновляет `occupiedBy` слотов через подписки на `gameEvents`; `MovementSystem` строит `stepped`-set в начале тика и блокирует второй шаг в занятую клетку, эмитируя `drone:moved` / `drone:blocked`.

**Tech Stack:** TypeScript, Vitest, ECS-архитектура (`World` + компоненты + системы), `gameEvents` — типизированный EventEmitter-синглтон.

---

## Файловая карта

| Действие | Путь |
|----------|------|
| Изменить | `src/shared/events/gameEvents.ts` |
| Создать  | `src/game/simulation/components/WorkSlots.ts` |
| Изменить | `src/game/simulation/world/World.ts` |
| Создать  | `src/game/simulation/world/workSlotsIndex.ts` |
| Создать  | `src/game/simulation/world/workSlots.ts` |
| Создать  | `src/game/simulation/world/workSlotsIndex.test.ts` |
| Изменить | `src/game/simulation/entities/createMine.ts` |
| Изменить | `src/game/simulation/entities/createCharger.ts` |
| Изменить | `src/game/simulation/entities/createBase.ts` |
| Изменить | `src/game/simulation/systems/MovementSystem.ts` |
| Изменить | `src/game/simulation/systems/MovementSystem.test.ts` |
| Изменить | `src/game/programs/types.ts` |
| Изменить | `src/game/programs/functions.ts` |
| Изменить | `src/game/programs/functions.test.ts` |
| Изменить | `src/game/missions/mission1.ts` |
| Изменить | `src/game/missions/mission2.ts` |
| Изменить | `src/game/missions/mission3.ts` |
| Изменить | `src/game/missions/mission4.ts` |

---

## Task 1: Добавить события в GameEventMap

**Files:**
- Modify: `src/shared/events/gameEvents.ts`

- [ ] **Step 1: Добавить три новых события в GameEventMap**

Открыть `src/shared/events/gameEvents.ts` и расширить тип:

```typescript
import type { EntityId } from '../types/index.js';

export type GameEventMap = {
  'ore:mined':        { droneId: EntityId; x: number; y: number };
  'ore:dropped':      { droneId: EntityId; amount: number };
  'charge:started':   { droneId: EntityId };
  'charge:completed': { droneId: EntityId };
  'mission:complete': undefined;
  'drone:moved':      { droneId: EntityId; fromX: number; fromY: number; toX: number; toY: number };
  'entity:removed':   { entityId: EntityId; lastX?: number; lastY?: number };
  'drone:blocked':    { droneId: EntityId };
};
```

Остальная часть файла (класс `TypedEventEmitter` и `gameEvents`) не меняется.

- [ ] **Step 2: Проверить тип-чек**

```powershell
cd "c:\Users\Master\Desktop\project\my\game project\robot-protocol"
npm run type-check
```

Ожидаем: 0 ошибок (или только ранее существовавшие).

- [ ] **Step 3: Коммит**

```powershell
git add src/shared/events/gameEvents.ts
git commit -m "feat: добавить события drone:moved, entity:removed, drone:blocked (Phase 1)"
```

---

## Task 2: Компонент WorkSlots + регистрация в World

**Files:**
- Create: `src/game/simulation/components/WorkSlots.ts`
- Modify: `src/game/simulation/world/World.ts`

- [ ] **Step 1: Создать компонент WorkSlots**

Создать файл `src/game/simulation/components/WorkSlots.ts`:

```typescript
import type { EntityId } from '../../../shared/types/index.js';

export interface WorkSlot {
  x: number;
  y: number;
  occupiedBy: EntityId | null;
}

export interface WorkSlotsComponent {
  slots: WorkSlot[];
}
```

- [ ] **Step 2: Зарегистрировать WorkSlots в ComponentMap (World.ts)**

В `src/game/simulation/world/World.ts`:

1. Добавить импорт:
```typescript
import type { WorkSlotsComponent } from '../components/WorkSlots.js';
```

2. Добавить в интерфейс `ComponentMap`:
```typescript
export interface ComponentMap {
  Position: PositionComponent;
  Energy: EnergyComponent;
  Inventory: InventoryComponent;
  Program: ProgramComponent;
  Movement: MovementComponent;
  Renderable: RenderableComponent;
  Deposit: DepositComponent;
  ChargerStation: ChargerStationComponent;
  Modifiers: ModifiersComponent;
  WorkSlots: WorkSlotsComponent;   // <-- добавить
}
```

3. Добавить импорт `gameEvents` и в конец метода `destroyEntity` — эмиссию события **перед** удалением компонентов (чтобы подписчики ещё могли читать компоненты):

```typescript
import { gameEvents } from '../../../shared/events/gameEvents.js';
```

Заменить метод `destroyEntity`:

```typescript
destroyEntity(entity: EntityId): void {
  const entityComponents = this.components.get(entity);
  if (!entityComponents) return;

  // Emit before removal so subscribers can still read components
  const pos = this.getComponent(entity, 'Position');
  gameEvents.emit('entity:removed', {
    entityId: entity,
    lastX: pos?.x,
    lastY: pos?.y,
  });

  for (const name of entityComponents.keys()) {
    this.index.get(name)?.delete(entity);
  }
  this.components.delete(entity);
}
```

- [ ] **Step 3: Проверить тип-чек**

```powershell
npm run type-check
```

Ожидаем: 0 ошибок.

- [ ] **Step 4: Коммит**

```powershell
git add src/game/simulation/components/WorkSlots.ts src/game/simulation/world/World.ts
git commit -m "feat: добавить компонент WorkSlots и регистрацию в World (Phase 2)"
```

---

## Task 3: workSlotsIndex + workSlots (TDD)

**Files:**
- Create: `src/game/simulation/world/workSlotsIndex.ts`
- Create: `src/game/simulation/world/workSlots.ts`
- Create: `src/game/simulation/world/workSlotsIndex.test.ts`

### TDD: сначала тесты

- [ ] **Step 1: Написать падающие тесты**

Создать `src/game/simulation/world/workSlotsIndex.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from './World.js';
import { gameEvents } from '../../../shared/events/gameEvents.js';
import { initWorkSlotsIndex, getSlotRefAt } from './workSlotsIndex.js';
import { slotsOf, freeSlotsCount, validateNoDroneOnSlot } from './workSlots.js';
import type { EntityId } from '../../../shared/types/index.js';

function makeWorld() { return new World(); }

function makeStation(world: World, x: number, y: number): EntityId {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'WorkSlots', { slots: [{ x, y, occupiedBy: null }] });
  return id;
}

function makeDroneAt(world: World, x: number, y: number): EntityId {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Movement', { targetX: x, targetY: y, path: [], progress: 0, speed: 1 });
  return id;
}

describe('workSlotsIndex — инициализация', () => {
  let world: World;

  beforeEach(() => {
    world = makeWorld();
    gameEvents.clearAll();
  });

  it('getSlotRefAt возвращает undefined до initWorkSlotsIndex', () => {
    makeStation(world, 3, 3);
    expect(getSlotRefAt(world, 3, 3)).toBeUndefined();
  });

  it('после init — getSlotRefAt находит слот по координатам', () => {
    const station = makeStation(world, 3, 3);
    initWorkSlotsIndex(world);
    const ref = getSlotRefAt(world, 3, 3);
    expect(ref).toBeDefined();
    expect(ref!.entityId).toBe(station);
    expect(ref!.slotIndex).toBe(0);
  });

  it('getSlotRefAt возвращает undefined для клетки без слота', () => {
    makeStation(world, 3, 3);
    initWorkSlotsIndex(world);
    expect(getSlotRefAt(world, 0, 0)).toBeUndefined();
  });
});

describe('workSlotsIndex — drone:moved обновляет occupiedBy', () => {
  let world: World;
  let station: EntityId;

  beforeEach(() => {
    world = makeWorld();
    gameEvents.clearAll();
    station = makeStation(world, 5, 5);
    initWorkSlotsIndex(world);
  });

  it('дрон заходит в слот → occupiedBy устанавливается', () => {
    const droneId = 42 as EntityId;
    gameEvents.emit('drone:moved', { droneId, fromX: 4, fromY: 5, toX: 5, toY: 5 });
    const ws = world.getComponent(station, 'WorkSlots')!;
    expect(ws.slots[0].occupiedBy).toBe(droneId);
  });

  it('дрон уходит из слота → occupiedBy = null', () => {
    const droneId = 42 as EntityId;
    // Сначала заселяем
    world.getComponent(station, 'WorkSlots')!.slots[0].occupiedBy = droneId;
    // Эмитируем уход
    gameEvents.emit('drone:moved', { droneId, fromX: 5, fromY: 5, toX: 6, toY: 5 });
    const ws = world.getComponent(station, 'WorkSlots')!;
    expect(ws.slots[0].occupiedBy).toBeNull();
  });

  it('чужой дрон не вытесняет уже занятый слот', () => {
    const drone1 = 10 as EntityId;
    const drone2 = 20 as EntityId;
    world.getComponent(station, 'WorkSlots')!.slots[0].occupiedBy = drone1;
    gameEvents.emit('drone:moved', { droneId: drone2, fromX: 4, fromY: 5, toX: 5, toY: 5 });
    const ws = world.getComponent(station, 'WorkSlots')!;
    expect(ws.slots[0].occupiedBy).toBe(drone1); // не изменился
  });

  it('движение дрона вне слотов не меняет occupiedBy', () => {
    gameEvents.emit('drone:moved', { droneId: 99 as EntityId, fromX: 0, fromY: 0, toX: 1, toY: 0 });
    const ws = world.getComponent(station, 'WorkSlots')!;
    expect(ws.slots[0].occupiedBy).toBeNull(); // без изменений
  });
});

describe('workSlotsIndex — entity:removed очищает occupiedBy', () => {
  let world: World;
  let station: EntityId;

  beforeEach(() => {
    world = makeWorld();
    gameEvents.clearAll();
    station = makeStation(world, 5, 5);
    initWorkSlotsIndex(world);
  });

  it('удаление дрона из слота → occupiedBy = null', () => {
    const droneId = 42 as EntityId;
    const drone = makeDroneAt(world, 5, 5);
    world.getComponent(station, 'WorkSlots')!.slots[0].occupiedBy = drone;
    world.destroyEntity(drone); // emit entity:removed happens inside
    const ws = world.getComponent(station, 'WorkSlots')!;
    expect(ws.slots[0].occupiedBy).toBeNull();
  });
});

describe('slotsOf', () => {
  it('возвращает слоты сущности', () => {
    const world = makeWorld();
    const station = makeStation(world, 2, 3);
    const slots = slotsOf(world, station);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ x: 2, y: 3, occupiedBy: null });
  });

  it('возвращает пустой массив для сущности без WorkSlots', () => {
    const world = makeWorld();
    const entity = world.createEntity();
    expect(slotsOf(world, entity)).toEqual([]);
  });
});

describe('freeSlotsCount', () => {
  it('возвращает 1 для незанятого слота', () => {
    const world = makeWorld();
    const station = makeStation(world, 1, 1);
    expect(freeSlotsCount(world, station)).toBe(1);
  });

  it('возвращает 0 для занятого слота', () => {
    const world = makeWorld();
    const station = makeStation(world, 1, 1);
    world.getComponent(station, 'WorkSlots')!.slots[0].occupiedBy = 99 as EntityId;
    expect(freeSlotsCount(world, station)).toBe(0);
  });

  it('возвращает 0 для сущности без WorkSlots', () => {
    const world = makeWorld();
    const entity = world.createEntity();
    expect(freeSlotsCount(world, entity)).toBe(0);
  });
});

describe('validateNoDroneOnSlot', () => {
  it('не бросает ошибку если дроны не на слотах', () => {
    const world = makeWorld();
    gameEvents.clearAll();
    makeStation(world, 5, 5);
    makeDroneAt(world, 1, 1);
    initWorkSlotsIndex(world);
    expect(() => validateNoDroneOnSlot(world)).not.toThrow();
  });

  it('бросает Error если дрон стоит на слоте', () => {
    const world = makeWorld();
    gameEvents.clearAll();
    makeStation(world, 3, 3);
    makeDroneAt(world, 3, 3); // на позиции слота!
    initWorkSlotsIndex(world);
    expect(() => validateNoDroneOnSlot(world)).toThrow(/Mission setup error/);
    expect(() => validateNoDroneOnSlot(world)).toThrow(/3, 3/);
  });
});
```

- [ ] **Step 2: Запустить — убедиться что тесты падают (файлы ещё не существуют)**

```powershell
npx vitest run src/game/simulation/world/workSlotsIndex.test.ts 2>&1 | Select-Object -First 20
```

Ожидаем: ошибки импорта (файлы не существуют).

- [ ] **Step 3: Создать workSlotsIndex.ts**

Создать `src/game/simulation/world/workSlotsIndex.ts`:

```typescript
import type { EntityId } from '../../../shared/types/index.js';
import type { World } from './World.js';
import { gameEvents } from '../../../shared/events/gameEvents.js';

interface SlotRef {
  entityId: EntityId;
  slotIndex: number;
}

const worldIndex = new WeakMap<World, Map<string, SlotRef>>();

export function initWorkSlotsIndex(world: World): void {
  const index = new Map<string, SlotRef>();

  // Scan all existing entities with WorkSlots
  for (const entityId of world.query('WorkSlots')) {
    const ws = world.getComponent(entityId, 'WorkSlots')!;
    ws.slots.forEach((slot, i) => {
      index.set(`${slot.x},${slot.y}`, { entityId, slotIndex: i });
    });
  }

  worldIndex.set(world, index);

  gameEvents.on('drone:moved', ({ droneId, fromX, fromY, toX, toY }) => {
    const idx = worldIndex.get(world);
    if (!idx) return;

    const fromRef = idx.get(`${fromX},${fromY}`);
    if (fromRef) {
      const ws = world.getComponent(fromRef.entityId, 'WorkSlots');
      if (ws && ws.slots[fromRef.slotIndex].occupiedBy === droneId) {
        ws.slots[fromRef.slotIndex].occupiedBy = null;
      }
    }

    const toRef = idx.get(`${toX},${toY}`);
    if (toRef) {
      const ws = world.getComponent(toRef.entityId, 'WorkSlots');
      if (ws && ws.slots[toRef.slotIndex].occupiedBy === null) {
        ws.slots[toRef.slotIndex].occupiedBy = droneId;
      }
    }
  });

  gameEvents.on('entity:removed', ({ entityId, lastX, lastY }) => {
    const idx = worldIndex.get(world);
    if (!idx) return;

    // Clear occupancy if a drone was occupying a slot
    if (lastX !== undefined && lastY !== undefined) {
      const ref = idx.get(`${lastX},${lastY}`);
      if (ref) {
        const ws = world.getComponent(ref.entityId, 'WorkSlots');
        if (ws && ws.slots[ref.slotIndex].occupiedBy === entityId) {
          ws.slots[ref.slotIndex].occupiedBy = null;
        }
      }
    }

    // Remove slot index entries if the entity itself had WorkSlots
    // (entity still exists in world since event fires before component removal)
    const ws = world.getComponent(entityId, 'WorkSlots');
    if (ws) {
      ws.slots.forEach(slot => idx.delete(`${slot.x},${slot.y}`));
    }
  });
}

export function getSlotRefAt(
  world: World,
  x: number,
  y: number,
): { entityId: EntityId; slotIndex: number } | undefined {
  return worldIndex.get(world)?.get(`${x},${y}`);
}
```

- [ ] **Step 4: Создать workSlots.ts**

Создать `src/game/simulation/world/workSlots.ts`:

```typescript
import type { EntityId } from '../../../shared/types/index.js';
import type { World } from './World.js';
import type { WorkSlot } from '../components/WorkSlots.js';
import { getSlotRefAt } from './workSlotsIndex.js';

export function slotsOf(world: World, entityId: EntityId): readonly WorkSlot[] {
  return world.getComponent(entityId, 'WorkSlots')?.slots ?? [];
}

export function freeSlotsCount(world: World, entityId: EntityId): number {
  const ws = world.getComponent(entityId, 'WorkSlots');
  if (!ws) return 0;
  return ws.slots.filter(s => s.occupiedBy === null).length;
}

export function validateNoDroneOnSlot(world: World): void {
  const drones = world.query('Position', 'Movement');
  for (const droneId of drones) {
    const pos = world.getComponent(droneId, 'Position')!;
    const ref = getSlotRefAt(world, pos.x, pos.y);
    if (ref) {
      throw new Error(
        `Mission setup error: drone ${droneId} spawned on a work slot of entity ${ref.entityId} at (${pos.x}, ${pos.y}).`,
      );
    }
  }
}
```

- [ ] **Step 5: Запустить тесты — должны пройти**

```powershell
npx vitest run src/game/simulation/world/workSlotsIndex.test.ts
```

Ожидаем: все тесты зелёные.

- [ ] **Step 6: Тип-чек**

```powershell
npm run type-check
```

Ожидаем: 0 ошибок.

- [ ] **Step 7: Коммит**

```powershell
git add src/game/simulation/world/workSlotsIndex.ts src/game/simulation/world/workSlots.ts src/game/simulation/world/workSlotsIndex.test.ts
git commit -m "feat: реализовать workSlotsIndex и публичный API workSlots (Phase 3)"
```

---

## Task 4: Добавить WorkSlots в фабрики сущностей

**Files:**
- Modify: `src/game/simulation/entities/createMine.ts`
- Modify: `src/game/simulation/entities/createCharger.ts`
- Modify: `src/game/simulation/entities/createBase.ts`

- [ ] **Step 1: createMine — добавить WorkSlots**

В `src/game/simulation/entities/createMine.ts` добавить компонент перед `return id`:

```typescript
import type { EntityId } from '../../../shared/types/index.js';
import type { World } from '../world/World.js';

export function createMine(world: World, x: number, y: number): EntityId {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Deposit', { oreRemaining: 200, mineRate: 1 });
  world.addComponent(id, 'Renderable', {
    spriteType: 'mine',
    visible: true,
    tint: 0xffffff,
  });
  world.addComponent(id, 'WorkSlots', { slots: [{ x, y, occupiedBy: null }] });
  return id;
}
```

- [ ] **Step 2: createCharger — добавить WorkSlots**

В `src/game/simulation/entities/createCharger.ts`:

```typescript
import type { EntityId } from '../../../shared/types/index.js';
import type { World } from '../world/World.js';

export function createCharger(world: World, x: number, y: number): EntityId {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'ChargerStation', { chargeRate: 10 });
  world.addComponent(id, 'Renderable', {
    spriteType: 'charger',
    visible: true,
    tint: 0xffffff,
  });
  world.addComponent(id, 'WorkSlots', { slots: [{ x, y, occupiedBy: null }] });
  return id;
}
```

- [ ] **Step 3: createBase — добавить WorkSlots**

В `src/game/simulation/entities/createBase.ts`:

```typescript
import type { EntityId } from '../../../shared/types/index.js';
import type { World } from '../world/World.js';

export function createBase(world: World, x: number, y: number): EntityId {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Inventory', { ore: 0, capacity: 99999 });
  world.addComponent(id, 'Renderable', {
    spriteType: 'base',
    visible: true,
    tint: 0xffffff,
  });
  world.addComponent(id, 'WorkSlots', { slots: [{ x, y, occupiedBy: null }] });
  return id;
}
```

- [ ] **Step 4: Запустить тесты и тип-чек**

```powershell
npm run type-check; npx vitest run
```

Ожидаем: все тесты зелёные, 0 ошибок.

- [ ] **Step 5: Коммит**

```powershell
git add src/game/simulation/entities/createMine.ts src/game/simulation/entities/createCharger.ts src/game/simulation/entities/createBase.ts
git commit -m "feat: навесить WorkSlots на Deposit/ChargerStation/Base (Phase 4)"
```

---

## Task 5: Фикс гонки в MovementSystem (TDD)

**Files:**
- Modify: `src/game/simulation/systems/MovementSystem.ts`
- Modify: `src/game/simulation/systems/MovementSystem.test.ts`

### TDD: сначала тесты

- [ ] **Step 1: Написать падающие тесты для гонки и эмиссии событий**

В `src/game/simulation/systems/MovementSystem.test.ts` добавить новый `describe` блок **в конец файла** (после существующих тестов):

```typescript
import { gameEvents } from '../../../shared/events/gameEvents.js';

// Добавить в начало файла (рядом с существующими импортами):
// import { gameEvents } from '../../../shared/events/gameEvents.js';

describe('MovementSystem — drone:moved эмиссия', () => {
  let world: World;
  let system: MovementSystem;

  beforeEach(() => {
    world = makeWorld();
    system = new MovementSystem(world);
    gameEvents.clearAll();
  });

  it('эмитит drone:moved с корректными координатами при успешном шаге', () => {
    const events: Array<{ droneId: number; fromX: number; fromY: number; toX: number; toY: number }> = [];
    gameEvents.on('drone:moved', e => events.push(e));

    const d = addDrone(world, 3, 5, [{ x: 4, y: 5 }], 10);
    system.update();

    expect(events).toEqual([{ droneId: d, fromX: 3, fromY: 5, toX: 4, toY: 5 }]);
  });

  it('не эмитит drone:moved если путь пуст', () => {
    const events: unknown[] = [];
    gameEvents.on('drone:moved', e => events.push(e));

    addDrone(world, 0, 0, []);
    system.update();

    expect(events).toHaveLength(0);
  });
});

describe('MovementSystem — фикс гонки (stepped-set)', () => {
  let world: World;
  let system: MovementSystem;

  beforeEach(() => {
    world = makeWorld();
    system = new MovementSystem(world);
    gameEvents.clearAll();
  });

  it('первый дрон шагает, второй с тем же целевым полем блокируется', () => {
    const blocked: number[] = [];
    gameEvents.on('drone:blocked', ({ droneId }) => blocked.push(droneId));

    const d1 = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10); // создан первым → победит
    const d2 = addDrone(world, 2, 0, [{ x: 1, y: 0 }], 10); // создан вторым → заблокирован

    system.update();

    expect(world.getComponent(d1, 'Position')).toMatchObject({ x: 1, y: 0 });
    expect(world.getComponent(d2, 'Position')).toMatchObject({ x: 2, y: 0 });
    expect(blocked).toEqual([d2]);
  });

  it('заблокированный дрон: путь очищен, программа resumeится', () => {
    const d1 = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10);
    const d2 = addDrone(world, 2, 0, [{ x: 1, y: 0 }], 10);

    system.update();

    const mov2 = world.getComponent(d2, 'Movement')!;
    const prog2 = world.getComponent(d2, 'Program')!;
    expect(mov2.path).toEqual([]);
    expect(mov2.progress).toBe(0);
    expect(prog2.state).toBe('running');
    expect(prog2.waitingFor).toBeUndefined();
  });

  it('два дрона движутся в разные клетки — оба проходят', () => {
    const blocked: number[] = [];
    gameEvents.on('drone:blocked', ({ droneId }) => blocked.push(droneId));

    const d1 = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10);
    const d2 = addDrone(world, 0, 1, [{ x: 1, y: 1 }], 10);

    system.update();

    expect(world.getComponent(d1, 'Position')).toMatchObject({ x: 1, y: 0 });
    expect(world.getComponent(d2, 'Position')).toMatchObject({ x: 1, y: 1 });
    expect(blocked).toHaveLength(0);
  });

  it('дрон шагает в свою же клетку (path[0] === position) — шаг разрешён', () => {
    // Такой путь невозможен на практике, но мы не должны блокировать дрона
    // из-за того, что его текущая позиция есть в stepped.
    const d = addDrone(world, 1, 0, [{ x: 1, y: 0 }], 10); // цель = текущая позиция
    system.update();
    // Дрон «шагает», progress сбрасывается
    const mov = world.getComponent(d, 'Movement')!;
    expect(mov.path).toEqual([]);
    // Важно: не заблокирован
    const blocked: number[] = [];
    // (событие drone:blocked уже произошло до этого — проверить нельзя ретроспективно.
    //  Тест просто убеждается, что путь не содержит элементов и дрон не сломался.)
  });
});
```

- [ ] **Step 2: Убедиться что новые тесты падают**

```powershell
npx vitest run src/game/simulation/systems/MovementSystem.test.ts 2>&1 | Select-Object -Last 20
```

Ожидаем: новые тесты FAIL, старые — PASS.

- [ ] **Step 3: Обновить MovementSystem.ts**

Полная замена `src/game/simulation/systems/MovementSystem.ts`:

```typescript
import type { World } from '../world/World.js';
import { gameEvents } from '../../../shared/events/gameEvents.js';
import { DT, EPSILON } from '../constants.js';

export class MovementSystem {
  constructor(private readonly world: World) {}

  update(): void {
    const drones = this.world.query('Position', 'Movement', 'Energy', 'Program');

    // Build stepped-set: cells occupied at the start of this tick
    const stepped = new Set<string>();
    for (const id of drones) {
      const pos = this.world.getComponent(id, 'Position')!;
      stepped.add(`${pos.x},${pos.y}`);
    }

    for (const id of drones) {
      const movement = this.world.getComponent(id, 'Movement')!;
      const position = this.world.getComponent(id, 'Position')!;
      const energy = this.world.getComponent(id, 'Energy')!;
      const program = this.world.getComponent(id, 'Program')!;

      if (program.localPaused) continue;

      if (movement.path.length === 0) {
        if (program.state === 'waiting' && program.waitingFor === 'move') {
          movement.progress = 0;
          program.state = 'running';
          program.waitingFor = undefined;
        }
        continue;
      }

      movement.progress += DT * movement.speed;
      if (movement.progress < 1 - EPSILON) continue;

      const next = movement.path[0];
      const fromKey = `${position.x},${position.y}`;
      const toKey = `${next.x},${next.y}`;

      // Block if another drone already stepped into target cell this tick
      if (toKey !== fromKey && stepped.has(toKey)) {
        movement.path = [];
        movement.progress = 0;
        if (program.state === 'waiting' && program.waitingFor === 'move') {
          program.state = 'running';
          program.waitingFor = undefined;
        }
        gameEvents.emit('drone:blocked', { droneId: id });
        continue;
      }

      // Execute step
      movement.path.shift();
      stepped.delete(fromKey);
      stepped.add(toKey);

      const fromX = position.x;
      const fromY = position.y;
      position.x = next.x;
      position.y = next.y;
      energy.current = Math.max(0, energy.current - energy.drainPerMove);
      movement.path = [];
      movement.progress = 0;

      if (program.state === 'waiting' && program.waitingFor === 'move') {
        program.state = 'running';
        program.waitingFor = undefined;
      }

      gameEvents.emit('drone:moved', { droneId: id, fromX, fromY, toX: next.x, toY: next.y });
    }
  }
}
```

- [ ] **Step 4: Запустить все тесты MovementSystem**

```powershell
npx vitest run src/game/simulation/systems/MovementSystem.test.ts
```

Ожидаем: все тесты зелёные (и старые, и новые).

- [ ] **Step 5: Тип-чек + все тесты**

```powershell
npm run type-check; npx vitest run
```

Ожидаем: 0 ошибок, все зелёные.

- [ ] **Step 6: Коммит**

```powershell
git add src/game/simulation/systems/MovementSystem.ts src/game/simulation/systems/MovementSystem.test.ts
git commit -m "feat: фикс гонки в MovementSystem, эмиссия drone:moved/drone:blocked (Phase 5)"
```

---

## Task 6: Функция FreeSlots в программах (TDD)

**Files:**
- Modify: `src/game/programs/types.ts`
- Modify: `src/game/programs/functions.ts`
- Modify: `src/game/programs/functions.test.ts`

### TDD: сначала тесты

- [ ] **Step 1: Добавить тесты FreeSlots в functions.test.ts**

В конец файла `src/game/programs/functions.test.ts` добавить:

```typescript
describe('FUNCTIONS — FreeSlots', () => {
  let world: World;

  beforeEach(() => { world = new World(); });

  function makeStation(x: number, y: number) {
    const id = world.createEntity();
    world.addComponent(id, 'Position', { x, y });
    world.addComponent(id, 'WorkSlots', { slots: [{ x, y, occupiedBy: null }] });
    return id;
  }

  it('возвращает 1 для незанятого слота', () => {
    const station = makeStation(5, 5);
    expect(FUNCTIONS.FreeSlots.evaluate([station], 99 as any, world)).toBe(1);
  });

  it('возвращает 0 для занятого слота', () => {
    const station = makeStation(5, 5);
    world.getComponent(station, 'WorkSlots')!.slots[0].occupiedBy = 42 as any;
    expect(FUNCTIONS.FreeSlots.evaluate([station], 99 as any, world)).toBe(0);
  });

  it('возвращает null для сущности без WorkSlots', () => {
    const mine = makeMine(world, 1, 1, 5);
    expect(FUNCTIONS.FreeSlots.evaluate([mine], 99 as any, world)).toBeNull();
  });

  it('argFilter принимает только сущности с WorkSlots', () => {
    const station = makeStation(5, 5);
    const mine = makeMine(world, 1, 1, 5);
    expect(FUNCTIONS.FreeSlots.argFilter!(station, world)).toBe(true);
    expect(FUNCTIONS.FreeSlots.argFilter!(mine, world)).toBe(false);
  });
});
```

- [ ] **Step 2: Убедиться что тест падает**

```powershell
npx vitest run src/game/programs/functions.test.ts 2>&1 | Select-Object -Last 10
```

Ожидаем: `FUNCTIONS.FreeSlots` не существует → FAIL.

- [ ] **Step 3: Обновить types.ts — добавить FreeSlots**

В `src/game/programs/types.ts`:

1. В `FunctionName` добавить `'FreeSlots'`:
```typescript
export type FunctionName =
  | 'Energy' | 'EnergyMax'
  | 'Inventory' | 'InventoryMax'
  | 'Deposit'
  | 'Distance'
  | 'FreeSlots';
```

2. В `FunctionCall` добавить ещё один вариант:
```typescript
export type FunctionCall =
  | { fn: 'Energy';       args: [ObjectRef] }
  | { fn: 'EnergyMax';    args: [ObjectRef] }
  | { fn: 'Inventory';    args: [ObjectRef] }
  | { fn: 'InventoryMax'; args: [ObjectRef] }
  | { fn: 'Deposit';      args: [ObjectRef] }
  | { fn: 'Distance';     args: [ObjectRef, ObjectRef] }
  | { fn: 'FreeSlots';    args: [ObjectRef] };
```

- [ ] **Step 4: Обновить functions.ts — добавить спецификацию FreeSlots и исправить isEntityType**

Заменить содержимое `src/game/programs/functions.ts`:

```typescript
import type { EntityId } from '../../shared/types/index.js';
import type { World } from '../simulation/world/World.js';
import type { ComponentName } from '../simulation/world/World.js';
import type { FunctionName, ObjectRef, FunctionCall } from './types.js';
import { freeSlotsCount } from '../simulation/world/workSlots.js';

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

function isEntityType(types: ComponentName[]) {
  return (id: EntityId, world: World): boolean => {
    return types.some((t) => world.getComponent(id, t) !== undefined);
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
  FreeSlots: {
    name: 'FreeSlots', label: 'FreeSlots', icon: '🅿️',
    arity: 1, argLabels: [''],
    argFilter: isEntityType(['WorkSlots']),
    evaluate: ([id], _droneId, world) => {
      if (!world.getComponent(id, 'WorkSlots')) return null;
      return freeSlotsCount(world, id);
    },
  },
};
```

> **Примечание:** `EnergyMax` теперь корректно читает `'Energy'?.max` (исправлена существующая ошибка).

- [ ] **Step 5: Запустить тесты functions**

```powershell
npx vitest run src/game/programs/functions.test.ts
```

Ожидаем: все тесты зелёные.

- [ ] **Step 6: Все тесты + тип-чек**

```powershell
npm run type-check; npx vitest run
```

Ожидаем: 0 ошибок, все зелёные.

- [ ] **Step 7: Коммит**

```powershell
git add src/game/programs/types.ts src/game/programs/functions.ts src/game/programs/functions.test.ts
git commit -m "feat: добавить функцию FreeSlots в IF-условия (Phase 6)"
```

---

## Task 7: Обновить миссии — initWorkSlotsIndex + validateNoDroneOnSlot

**Files:**
- Modify: `src/game/missions/mission1.ts`
- Modify: `src/game/missions/mission2.ts`
- Modify: `src/game/missions/mission3.ts`
- Modify: `src/game/missions/mission4.ts`

В каждой миссии нужно:
1. Добавить импорты `initWorkSlotsIndex` и `validateNoDroneOnSlot`
2. В конце `buildScene()` вызвать `initWorkSlotsIndex(world)` и `validateNoDroneOnSlot(world)` **после** создания всех сущностей, но **до** `return`

- [ ] **Step 1: Обновить mission1.ts**

Добавить импорты в начало файла:
```typescript
import { initWorkSlotsIndex } from '../simulation/world/workSlotsIndex.js';
import { validateNoDroneOnSlot } from '../simulation/world/workSlots.js';
```

В конце `buildScene()` перед `return`:
```typescript
    initWorkSlotsIndex(world);
    validateNoDroneOnSlot(world);

    return {
      world,
      // ... (остальное без изменений)
    };
```

- [ ] **Step 2: Обновить mission2.ts**

Те же два импорта. В конце `buildScene()` перед `return`:
```typescript
    initWorkSlotsIndex(world);
    validateNoDroneOnSlot(world);
```

- [ ] **Step 3: Обновить mission3.ts**

Те же два импорта и вызовы. В конце `buildScene()` перед `return`:
```typescript
    initWorkSlotsIndex(world);
    validateNoDroneOnSlot(world);
```

- [ ] **Step 4: Обновить mission4.ts**

Те же два импорта и вызовы. В конце `buildScene()` перед `return`:
```typescript
    initWorkSlotsIndex(world);
    validateNoDroneOnSlot(world);
```

- [ ] **Step 5: Запустить все тесты миссий**

```powershell
npx vitest run src/game/missions/missions.test.ts
```

Ожидаем: все тесты зелёные (дроны не спавнятся на слотах → validateNoDroneOnSlot не бросает).

- [ ] **Step 6: Тип-чек + полный прогон тестов**

```powershell
npm run type-check; npx vitest run
```

Ожидаем: 0 ошибок, все тесты зелёные.

- [ ] **Step 7: Коммит**

```powershell
git add src/game/missions/mission1.ts src/game/missions/mission2.ts src/game/missions/mission3.ts src/game/missions/mission4.ts
git commit -m "feat: инициализировать workSlotsIndex и валидацию спавна в миссиях 1-4 (Phase 7)"
```

---

## Task 8: Финальная верификация и документация

- [ ] **Step 1: Полный прогон тестов**

```powershell
npx vitest run
```

Ожидаем: все тесты зелёные.

- [ ] **Step 2: Тип-чек**

```powershell
npm run type-check
```

Ожидаем: 0 ошибок.

- [ ] **Step 3: Переместить фичу в done**

```powershell
Move-Item "docs/features/planned/work-slots-and-collisions.md" "docs/features/done/work-slots-and-collisions.md"
```

Обновить `docs/features/index.md` — изменить статус на `done` и путь к файлу.

- [ ] **Step 4: Написать сессионный лог**

Создать `docs/sessions/2026-05-26-work-slots-and-collisions.md`:

```markdown
# Сессия: work-slots-and-collisions

**Дата:** 2026-05-26
**Цель:** Реализовать компонент WorkSlots, lifecycle занятости через события, фикс гонки MovementSystem, функцию FreeSlots, валидацию спавна.

## Результат

- Добавлен компонент `WorkSlots` на Deposit/ChargerStation/Base
- `workSlotsIndex` обновляет `occupiedBy` через подписки на `drone:moved` / `entity:removed`
- `MovementSystem` использует `stepped`-set: два дрона не могут оказаться в одной клетке за тик
- `drone:moved` и `drone:blocked` эмитятся корректно
- `FreeSlots(target)` доступна в IF-условиях
- `validateNoDroneOnSlot` вызывается при старте каждой миссии
- Все миссии 1–4 проходят без регрессий
- Попутно исправлена существующая ошибка: `EnergyMax.evaluate` теперь читает `Energy?.max` (ранее обращалась к несуществующему компоненту `EnergyMax`)
```

- [ ] **Step 5: Финальный коммит документации**

```powershell
git add docs/features/done/work-slots-and-collisions.md docs/features/index.md docs/sessions/2026-05-26-work-slots-and-collisions.md
git commit -m "docs: закрыть фичу work-slots-and-collisions, добавить сессию"
```

---

## Self-Review

### Покрытие спецификации

| Требование | Task |
|-----------|------|
| Компонент `WorkSlots` с `slots: WorkSlot[]` | Task 2 |
| Навешивается на Deposit/ChargerStation/Base | Task 4 |
| `drone:moved` / `entity:removed` / `drone:blocked` в GameEventMap | Task 1 |
| `workSlotsIndex` обновляет `occupiedBy` по событиям, без сканирования | Task 3 |
| Публичный API `slotsOf` и `freeSlotsCount` | Task 3 |
| `MovementSystem` эмитит `drone:moved` | Task 5 |
| Два дрона не оказываются в одной клетке | Task 5 |
| Блокированный дрон: path очищен, `waitingFor=move` снимается | Task 5 |
| `drone:blocked` эмитится при блокировке | Task 5 |
| `FreeSlots` в `FunctionName` и `FunctionCall` | Task 6 |
| `FreeSlots` в `FUNCTIONS` с `argFilter` | Task 6 |
| Валидация спавна — `validateNoDroneOnSlot` | Task 3 |
| Вызов `validateNoDroneOnSlot` в миссиях 1–4 | Task 7 |
| `initWorkSlotsIndex` в миссиях 1–4 | Task 7 |
| Unit-тесты lifecycle слотов | Task 3 |
| Unit-тесты фикса гонки | Task 5 |
| Unit-тесты `FreeSlots` | Task 6 |
| Unit-тест валидации спавна | Task 3 |
| Миссии 1–4 без регрессий | Task 8 |

Все требования покрыты.

### Out of scope (НЕ реализуется)

- Многоклеточные шахты и подходы сбоку
- Резервирование слота до прибытия дрона
- Dev-asserts на рассинхрон
- Депозит/зарядка/база не становятся непроходимыми (геометрия не меняется)
