# Atomic Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать игровые действия дрона (`MOVE_TO`, `MINE`, `DROP`, `CHARGE`) атомарными: одна команда = одна единица работы. Макроповедение игрок строит сам через `LOOP` / `REPEAT` / `IF`.

**Architecture:** Изменения локализованы в трёх системах симуляции (`MovementSystem`, `MiningSystem`, `EnergySystem`). AST и интерпретатор не трогаем — они уже разделяют активную команду (через `waitingFor`) и сам тик действия. Каждая система после одной выполненной «единицы работы» сразу снимает `waitingFor` и переводит программу в `running`, вместо того чтобы крутить `while` до полного «дренажа». Пассивная зарядка на станции (когда нет активной `CHARGE`) сохраняется без изменений как свойство станции.

**Tech Stack:** TypeScript, Vitest (unit + integration), Playwright (только smoke). Симуляция чистая, без Phaser.

---

## File Structure

**Modify:**
- [src/game/simulation/systems/MovementSystem.ts](../../../src/game/simulation/systems/MovementSystem.ts) — одна команда `MOVE_TO` = один шаг по `path`; после шага путь зачищается и программа возобновляется.
- [src/game/simulation/systems/MiningSystem.ts](../../../src/game/simulation/systems/MiningSystem.ts) — `MINE` и `DROP` обрабатывают ровно одну единицу руды за вызов, потом возобновляют программу.
- [src/game/simulation/systems/EnergySystem.ts](../../../src/game/simulation/systems/EnergySystem.ts) — активная `CHARGE` даёт +1 и завершается; пассивная зарядка не меняется.
- [src/game/simulation/systems/MovementSystem.test.ts](../../../src/game/simulation/systems/MovementSystem.test.ts) — обновить ожидания для новой семантики.
- [src/game/simulation/systems/MiningSystem.test.ts](../../../src/game/simulation/systems/MiningSystem.test.ts) — обновить ожидания.
- [src/game/simulation/systems/EnergySystem.test.ts](../../../src/game/simulation/systems/EnergySystem.test.ts) — обновить ожидания.
- [DECISIONS.md](../../../DECISIONS.md) — добавить запись о решении.
- [docs/features/index.md](../../features/index.md) — переместить фичу из planned в done.

**Create:**
- `src/game/simulation/atomic-actions.integration.test.ts` — интеграционный тест: `LOOP { MINE }` через `ProgramExecutionSystem` + `MiningSystem` добывает руду порционно.

**Move:**
- `docs/features/planned/atomic-actions.md` → `docs/features/done/atomic-actions.md` (после успешной реализации).

**Do NOT modify:**
- `src/game/programs/types.ts` — AST не меняется.
- `src/game/programs/interpreter.ts` — интерпретатор не меняется.
- `src/game/simulation/constants.ts` — длительности и стоимости энергии не меняются.

---

## Why TDD for this feature

Семантика меняется в живом коде, который покрыт тестами. Подход на каждую систему:

1. Сначала переписываем тесты под новую атомарную семантику. Запускаем — старые тесты падают, новые падают.
2. Меняем продакшен-код.
3. Тесты зеленеют.
4. Коммитим.

Это даёт ровно одну причину провала на каждом шаге: либо тест неверен, либо реализация. Никакого «попозже допишем».

---

## Task 1: MovementSystem — атомарный шаг

**Files:**
- Modify: `src/game/simulation/systems/MovementSystem.test.ts`
- Modify: `src/game/simulation/systems/MovementSystem.ts`

### Что меняется в семантике

Сейчас за один тик при `speed >= 20` дрон может пройти несколько клеток, потому что внутри `update()` крутится `while (progress >= 1)`. После фичи: за одну команду `MOVE_TO` дрон делает ровно один шаг (даже если `progress` накопился ≥ 2). Остаток пути в `movement.path` после шага зачищается (следующая команда `MOVE_TO` пересчитает A* заново). Если `movement.path` пуст в момент `waitingFor === 'move'` — команда завершается сразу (как и сейчас).

- [ ] **Step 1: Переписать тест «advances multiple steps when speed=20»**

Открыть [src/game/simulation/systems/MovementSystem.test.ts:72-78](../../../src/game/simulation/systems/MovementSystem.test.ts#L72-L78) и заменить:

```ts
  // speed=20: progress += 2.0 за тик → новая семантика: всё равно 1 шаг за команду
  it('advances exactly one cell per command even when speed=20', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }, { x: 2, y: 0 }], 20);
    system.update();
    const pos = world.getComponent(id, 'Position')!;
    expect(pos.x).toBe(1);
    expect(pos.y).toBe(0);
  });
```

- [ ] **Step 2: Переписать тест «drains energy for each step when multiple steps in one tick»**

Заменить тест на [src/game/simulation/systems/MovementSystem.test.ts:80-85](../../../src/game/simulation/systems/MovementSystem.test.ts#L80-L85):

```ts
  it('drains energy only once per atomic step even at speed=20', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }, { x: 2, y: 0 }], 20);
    system.update();
    const energy = world.getComponent(id, 'Energy')!;
    expect(energy.current).toBe(95); // 100 - 5*1 (атомарный шаг)
  });
```

- [ ] **Step 3: Переписать тест «moves drone one cell after 10 ticks at speed=1»**

Этот тест зависит от того, что движение продолжается после первой клетки. Под новую семантику команда завершится после первой клетки. Заменить тест на [src/game/simulation/systems/MovementSystem.test.ts:47-53](../../../src/game/simulation/systems/MovementSystem.test.ts#L47-L53):

```ts
  it('moves drone exactly one cell after 10 ticks at speed=1, then stops', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }, { x: 2, y: 0 }], 1);
    for (let i = 0; i < 10; i++) system.update();
    const pos = world.getComponent(id, 'Position')!;
    expect(pos.x).toBe(1);
    expect(pos.y).toBe(0);
    // Дополнительные тики не сдвинут дрон — путь зачищен.
    for (let i = 0; i < 10; i++) system.update();
    const pos2 = world.getComponent(id, 'Position')!;
    expect(pos2.x).toBe(1);
  });
```

- [ ] **Step 4: Добавить тест: путь очищается после шага**

Добавить в конец `describe('MovementSystem', …)`:

```ts
  it('clears the remaining path after one atomic step', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }], 10);
    system.update();
    const movement = world.getComponent(id, 'Movement')!;
    expect(movement.path).toEqual([]);
    expect(movement.progress).toBe(0);
  });
```

- [ ] **Step 5: Запустить тесты — увидеть провалы**

Run: `npm test -- MovementSystem`
Expected: новые тесты падают (старая реализация двигает 2 клетки при speed=20 и тратит 10 energy; продолжает после первого шага).

- [ ] **Step 6: Переписать `MovementSystem.update()`**

Заменить тело метода на:

```ts
  update(): void {
    const drones = this.world.query('Position', 'Movement', 'Energy', 'Program');
    for (const id of drones) {
      const movement = this.world.getComponent(id, 'Movement')!;
      const position = this.world.getComponent(id, 'Position')!;
      const energy = this.world.getComponent(id, 'Energy')!;
      const program = this.world.getComponent(id, 'Program')!;

      if (program.localPaused) continue;

      // Путь пуст: если ждали move — снимаем ожидание сразу.
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

      // Атомарный шаг: ровно одна клетка, остаток пути выбрасываем.
      const next = movement.path.shift()!;
      position.x = next.x;
      position.y = next.y;
      energy.current = Math.max(0, energy.current - energy.drainPerMove);
      movement.path = [];
      movement.progress = 0;

      if (program.state === 'waiting' && program.waitingFor === 'move') {
        program.state = 'running';
        program.waitingFor = undefined;
      }
    }
  }
```

- [ ] **Step 7: Запустить тесты — должны пройти**

Run: `npm test -- MovementSystem`
Expected: все 11 тестов проходят.

- [ ] **Step 8: Type-check**

Run: `npm run type-check`
Expected: 0 ошибок.

- [ ] **Step 9: Коммит**

```bash
git add src/game/simulation/systems/MovementSystem.ts src/game/simulation/systems/MovementSystem.test.ts
git commit -m "$(cat <<'EOF'
feat: атомарный MOVE_TO — один шаг за команду

Команда MOVE_TO теперь завершается после одной пройденной клетки,
остаток A*-пути выбрасывается. Макропередвижение строится через LOOP.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: MiningSystem — атомарный MINE

**Files:**
- Modify: `src/game/simulation/systems/MiningSystem.test.ts`
- Modify: `src/game/simulation/systems/MiningSystem.ts`

### Что меняется

Сейчас за одно `waitingFor=mine` копается «пока депозит/инвентарь позволяют». После фичи: накопил `BASE_MINE_DURATION_PER_ORE` → +1 руда, +1 расход энергии, событие `ore:mined`, программа возобновляется. Следующий `MINE` нужно вызывать новой командой.

- [ ] **Step 1: Обновить тест «mines 2 ore after 40 ticks»**

Под новую семантику после первой руды программа возобновится и `waitingFor` уйдёт — больше руды не накопаем. Заменить тест на [src/game/simulation/systems/MiningSystem.test.ts:68-73](../../../src/game/simulation/systems/MiningSystem.test.ts#L68-L73):

```ts
  it('mines only 1 ore even after 40 ticks (atomic: command completes after first ore)', () => {
    const drone = addDrone(world, 2, 3);
    addDeposit(world, 2, 3, 50, 1);
    for (let i = 0; i < TICKS_PER_ORE_MINE * 2; i++) system.update();
    expect(world.getComponent(drone, 'Inventory')!.ore).toBe(1);
  });
```

- [ ] **Step 2: Добавить тест: после MINE программа становится running**

Добавить в `describe('MiningSystem — MINE', …)`:

```ts
  it('resumes program (running) immediately after mining one ore', () => {
    const drone = addDrone(world, 2, 3);
    addDeposit(world, 2, 3, 50, 1);
    for (let i = 0; i < TICKS_PER_ORE_MINE; i++) system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
    expect(program.waitingFor).toBeUndefined();
    expect(program.mineElapsed).toBeUndefined();
  });
```

- [ ] **Step 3: Обновить тест «transfers all ore gradually (2 ore in 10 ticks)»**

DROP теперь тоже атомарен: одна команда = одна руда. Заменить тест на [src/game/simulation/systems/MiningSystem.test.ts:152-158](../../../src/game/simulation/systems/MiningSystem.test.ts#L152-L158):

```ts
  it('transfers only 1 ore per command even after 10 ticks (atomic)', () => {
    const drone = addDrone(world, 5, 5, 2, 10, 'drop');
    const base = addBase(world, 5, 5);
    for (let i = 0; i < TICKS_PER_ORE_DROP * 2; i++) system.update();
    expect(world.getComponent(drone, 'Inventory')!.ore).toBe(1);
    expect(world.getComponent(base, 'Inventory')!.ore).toBe(1);
  });
```

- [ ] **Step 4: Запустить тесты — увидеть провалы**

Run: `npm test -- MiningSystem`
Expected: новые тесты ожидают 1 руду, старая реализация даёт 2.

- [ ] **Step 5: Переписать `processMining`**

Открыть `src/game/simulation/systems/MiningSystem.ts` и заменить блок `program.mineElapsed = (program.mineElapsed ?? 0) + DT; while (...) { ... } if (...) { ... }` ([строки 43-58](../../../src/game/simulation/systems/MiningSystem.ts#L43-L58)) на:

```ts
      program.mineElapsed = (program.mineElapsed ?? 0) + DT;

      if (program.mineElapsed >= BASE_MINE_DURATION_PER_ORE - EPSILON) {
        deposit.oreRemaining -= 1;
        inventory.ore += 1;
        energy.current = Math.max(0, energy.current - energy.drainPerMine);
        gameEvents.emit('ore:mined', { droneId: id, x: position.x, y: position.y });
        program.mineElapsed = undefined;
        program.state = 'running';
        program.waitingFor = undefined;
      }
```

- [ ] **Step 6: Переписать `processDrop`**

Заменить блок `program.dropElapsed = (program.dropElapsed ?? 0) + DT; while (...) { ... } if (...) { ... }` ([строки 82-95](../../../src/game/simulation/systems/MiningSystem.ts#L82-L95)) на:

```ts
      program.dropElapsed = (program.dropElapsed ?? 0) + DT;

      if (program.dropElapsed >= BASE_DROP_DURATION_PER_ORE - EPSILON) {
        baseInventory.ore += 1;
        droneInventory.ore -= 1;
        gameEvents.emit('ore:dropped', { droneId: id, amount: 1 });
        program.dropElapsed = undefined;
        program.state = 'running';
        program.waitingFor = undefined;
      }
```

- [ ] **Step 7: Запустить тесты — должны пройти**

Run: `npm test -- MiningSystem`
Expected: все тесты блока MiningSystem проходят.

- [ ] **Step 8: Type-check**

Run: `npm run type-check`
Expected: 0 ошибок.

- [ ] **Step 9: Коммит**

```bash
git add src/game/simulation/systems/MiningSystem.ts src/game/simulation/systems/MiningSystem.test.ts
git commit -m "$(cat <<'EOF'
feat: атомарные MINE и DROP — одна команда = одна руда

MINE добывает ровно +1 руду за вызов и возвращает программу в running.
DROP так же выгружает +1 руду. Макроповедение собирается через LOOP/REPEAT.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: EnergySystem — атомарный CHARGE с сохранением пассивной зарядки

**Files:**
- Modify: `src/game/simulation/systems/EnergySystem.test.ts`
- Modify: `src/game/simulation/systems/EnergySystem.ts`

### Что меняется и что НЕ меняется

- **Меняется:** активная команда `CHARGE` (когда `waitingFor === 'charge'`) даёт +1 энергии и сразу завершается.
- **Не меняется:** пассивная зарядка — дрон стоит на станции без активной `CHARGE`, всё ещё получает +1 / `BASE_CHARGE_DURATION_PER_UNIT`, и так далее, пока не заполнится. Это свойство станции, не команды.

- [ ] **Step 1: Переписать тест «does not resume program if not yet full»**

Старый тест ([строки 96-102](../../../src/game/simulation/systems/EnergySystem.test.ts#L96-L102)) считает, что после 5 тиков заряд продолжается (state=waiting). Под новую семантику после +1 единицы команда CHARGE завершается. Заменить:

```ts
  it('resumes program after charging +1 unit even if not full (atomic CHARGE)', () => {
    const drone = addDrone(world, 3, 3, 50);
    addCharger(world, 3, 3);
    for (let i = 0; i < TICKS_PER_UNIT; i++) system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
    expect(program.waitingFor).toBeUndefined();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(51);
  });
```

- [ ] **Step 2: Переписать тест «charges +2 energy after 10 ticks» (для активной CHARGE)**

При активной `CHARGE` за 10 тиков накопится только +1 (команда завершилась после 5 тиков). Заменить тест на [строки 65-70](../../../src/game/simulation/systems/EnergySystem.test.ts#L65-L70):

```ts
  it('active CHARGE adds exactly +1 even if 10 ticks pass (atomic)', () => {
    const drone = addDrone(world, 3, 3, 50);
    addCharger(world, 3, 3);
    for (let i = 0; i < TICKS_PER_UNIT * 2; i++) system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(51);
  });
```

- [ ] **Step 3: Адаптировать тест «does not exceed max energy»**

Текущий тест ([строки 72-77](../../../src/game/simulation/systems/EnergySystem.test.ts#L72-L77)) использует `waitingFor='charge'` и ждёт 15 тиков. Под атомарную команду CHARGE завершится после +1 → energy=100. Это и есть «не превышает max», но смысл теста меняется. Заменим на проверку **пассивной** зарядки (явно не ждём `charge`):

```ts
  it('passive charging does not exceed max energy', () => {
    const drone = addDrone(world, 3, 3, 99, 100, undefined);
    world.getComponent(drone, 'Program')!.state = 'running';
    world.getComponent(drone, 'Program')!.waitingFor = undefined;
    addCharger(world, 3, 3);
    for (let i = 0; i < TICKS_PER_UNIT * 3; i++) system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(100);
  });
```

- [ ] **Step 4: Добавить тест «passive charging continues across multiple units»**

Подтверждаем, что пассивная зарядка по-прежнему накапливает несколько единиц, а не одну за вызов:

```ts
  it('passive charging adds multiple units over time (not atomic)', () => {
    const drone = addDrone(world, 3, 3, 50, 100, undefined);
    world.getComponent(drone, 'Program')!.state = 'running';
    world.getComponent(drone, 'Program')!.waitingFor = undefined;
    addCharger(world, 3, 3);
    for (let i = 0; i < TICKS_PER_UNIT * 3; i++) system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(53);
  });
```

- [ ] **Step 5: Добавить тест «active CHARGE off charger completes immediately»**

```ts
  it('active CHARGE completes immediately when drone is not on a charger', () => {
    const drone = addDrone(world, 3, 3, 50);
    addCharger(world, 5, 5);
    system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
    expect(program.waitingFor).toBeUndefined();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(50);
  });
```

- [ ] **Step 6: Запустить тесты — увидеть провалы**

Run: `npm test -- EnergySystem`
Expected: новые тесты падают (старая реализация продолжает заряжать).

- [ ] **Step 7: Переписать `EnergySystem.update()`**

Заменить тело на:

```ts
  update(): void {
    const drones = this.world.query('Position', 'Energy', 'Program');
    const nowCharging = new Set<EntityId>();

    for (const id of drones) {
      const energy = this.world.getComponent(id, 'Energy')!;
      const position = this.world.getComponent(id, 'Position')!;
      const program = this.world.getComponent(id, 'Program')!;

      if (program.localPaused) continue;

      const isActiveCharge = program.state === 'waiting' && program.waitingFor === 'charge';

      const chargerId = this.findChargerAt(position.x, position.y);
      if (chargerId === null) {
        // Не на станции: активная CHARGE завершается сразу, ничего больше не делаем.
        if (isActiveCharge) {
          program.chargeElapsed = undefined;
          program.state = 'running';
          program.waitingFor = undefined;
        }
        continue;
      }

      // На станции и уже полная энергия — активная CHARGE завершается сразу.
      if (isActiveCharge && energy.current >= energy.max) {
        program.chargeElapsed = undefined;
        program.state = 'running';
        program.waitingFor = undefined;
        continue;
      }

      if (energy.current < energy.max) {
        program.chargeElapsed = (program.chargeElapsed ?? 0) + DT;
        // Пассивная зарядка: while-цикл сохранён, чтобы поведение станции не менялось.
        while (program.chargeElapsed >= BASE_CHARGE_DURATION_PER_UNIT - EPSILON && energy.current < energy.max) {
          energy.current = Math.min(energy.max, energy.current + 1);
          program.chargeElapsed -= BASE_CHARGE_DURATION_PER_UNIT;
          // Активная CHARGE: после первой выданной единицы — выход.
          if (isActiveCharge) {
            program.chargeElapsed = undefined;
            program.state = 'running';
            program.waitingFor = undefined;
            break;
          }
        }
      }

      if (isActiveCharge && program.waitingFor === 'charge') {
        nowCharging.add(id);
      }
    }

    for (const id of nowCharging) {
      if (!this._charging.has(id)) gameEvents.emit('charge:started', { droneId: id });
    }
    for (const id of this._charging) {
      if (!nowCharging.has(id)) gameEvents.emit('charge:completed', { droneId: id });
    }
    this._charging = nowCharging;
  }
```

Ключевые моменты:
- Пассивная зарядка идёт через тот же `while` как сейчас, поэтому свойство станции не меняется.
- Активная `CHARGE` выходит из цикла сразу после первой выданной единицы.
- Edge-кейсы (нет станции, уже полная) завершают команду без расхода времени.

- [ ] **Step 8: Запустить тесты — должны пройти**

Run: `npm test -- EnergySystem`
Expected: все тесты блока EnergySystem проходят.

- [ ] **Step 9: Type-check**

Run: `npm run type-check`
Expected: 0 ошибок.

- [ ] **Step 10: Коммит**

```bash
git add src/game/simulation/systems/EnergySystem.ts src/game/simulation/systems/EnergySystem.test.ts
git commit -m "$(cat <<'EOF'
feat: атомарная CHARGE — +1 энергии за команду

Активная команда CHARGE даёт ровно +1 и возвращает программу в running.
Пассивная зарядка на станции сохранена без изменений как свойство станции.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Интеграционный тест — `LOOP { MINE }` порционно

**Files:**
- Create: `src/game/simulation/atomic-actions.integration.test.ts`

### Зачем отдельный файл

Спецификация требует тест, который доказывает, что цикл `LOOP { MINE }` добывает по одной руде каждые `BASE_MINE_DURATION_PER_ORE` секунд (видна порционность). Это сшивка интерпретатора + `MiningSystem`. В `src/game/simulation/systems/MiningSystem.test.ts` интерпретатор не используется (там `waitingFor` выставляется руками). Поэтому создаём интеграционный тест на уровне симуляции.

Полноценный Playwright e2e сюда был бы избыточен (UI здесь не интересен), а интеграционный vitest даёт ровно то, что нужно: проверку, что после полного цикла «интерпретатор → MiningSystem → интерпретатор» наблюдается порционность.

- [ ] **Step 1: Создать файл с тестом**

Записать в `src/game/simulation/atomic-actions.integration.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { World } from './world/World.js';
import { Grid } from './world/Grid.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { ProgramExecutionSystem } from './systems/ProgramExecutionSystem.js';
import { MiningSystem } from './systems/MiningSystem.js';
import { BASE_MINE_DURATION_PER_ORE, DT } from './constants.js';
import type { ProgramRegistry } from '../programs/types.js';

const TICKS_PER_ORE = Math.round(BASE_MINE_DURATION_PER_ORE / DT); // 20

function setup() {
  const world = new World();
  const grid = new Grid();
  const collision = new CollisionSystem(world);
  const registry: ProgramRegistry = new Map([
    ['loop-mine', {
      id: 'loop-mine',
      name: 'Loop Mine',
      instructions: [{ type: 'LOOP', body: [{ type: 'MINE' }] } as never],
    }],
  ]);
  const exec = new ProgramExecutionSystem(world, grid, collision, registry);
  const mining = new MiningSystem(world);

  const drone = world.createEntity();
  world.addComponent(drone, 'Position', { x: 0, y: 0 });
  world.addComponent(drone, 'Energy', { current: 100, max: 100, drainPerMove: 5, drainPerMine: 2 });
  world.addComponent(drone, 'Inventory', { ore: 0, capacity: 10 });
  world.addComponent(drone, 'Movement', { targetX: 0, targetY: 0, path: [], progress: 0, speed: 1 });
  world.addComponent(drone, 'Program', {
    currentProgramId: 'loop-mine',
    callStack: [{ programId: 'loop-mine', instructionIndex: 0 }],
    state: 'running',
    commandSlots: 4,
    personalProgramId: '',
  });

  const deposit = world.createEntity();
  world.addComponent(deposit, 'Position', { x: 0, y: 0 });
  world.addComponent(deposit, 'Deposit', { oreRemaining: 3, mineRate: 1 });

  function tick() {
    collision.update();
    exec.update();
    mining.update();
  }

  return { world, drone, deposit, tick };
}

describe('atomic actions integration: LOOP { MINE }', () => {
  it('mines exactly one ore per BASE_MINE_DURATION_PER_ORE, not all at once', () => {
    const { world, drone, tick } = setup();

    // Прогон достаточен на 3 итерации цикла. Каждая итерация: 1 тик интерпретатора
    // выставляет waitingFor=mine, потом TICKS_PER_ORE тиков MiningSystem копит время,
    // потом MINE выдаёт +1 руду и возвращает программу в running.
    let oreAtSnapshots: number[] = [];
    for (let iter = 0; iter < 3; iter++) {
      // ~TICKS_PER_ORE+1 тиков на одну руду (учитываем тик-выставление waitingFor)
      for (let i = 0; i < TICKS_PER_ORE + 1; i++) tick();
      oreAtSnapshots.push(world.getComponent(drone, 'Inventory')!.ore);
    }

    // Порционность: каждый замер должен показывать ровно +1 руду относительно предыдущего.
    expect(oreAtSnapshots).toEqual([1, 2, 3]);
  });

  it('does not mine more than one ore within a single BASE_MINE_DURATION window', () => {
    const { world, drone, tick } = setup();
    // Прогон ровно на TICKS_PER_ORE тиков после первой команды — никаких +2 за этот период.
    for (let i = 0; i < TICKS_PER_ORE + 1; i++) tick();
    expect(world.getComponent(drone, 'Inventory')!.ore).toBe(1);
    // Ещё пол-окна — пока всё ещё 1.
    for (let i = 0; i < Math.floor(TICKS_PER_ORE / 2); i++) tick();
    expect(world.getComponent(drone, 'Inventory')!.ore).toBe(1);
  });
});
```

- [ ] **Step 2: Запустить интеграционный тест**

Run: `npm test -- atomic-actions.integration`
Expected: оба теста проходят.

- [ ] **Step 3: Запустить весь unit-suite**

Run: `npm test`
Expected: все тесты проходят. Если что-то падает — это сигнал, что фича разломала ещё какие-то места; чинить здесь, а не «прятать».

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: 0 ошибок.

- [ ] **Step 5: Коммит**

```bash
git add src/game/simulation/atomic-actions.integration.test.ts
git commit -m "$(cat <<'EOF'
test: интеграционный тест порционности LOOP { MINE }

Доказывает, что цикл LOOP { MINE } добывает по одной руде
за BASE_MINE_DURATION_PER_ORE, а не выгружает депозит залпом.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Документация — DECISIONS, перенос фичи

**Files:**
- Modify: `DECISIONS.md`
- Move: `docs/features/planned/atomic-actions.md` → `docs/features/done/atomic-actions.md`
- Modify: `docs/features/index.md`

- [ ] **Step 1: Добавить запись в `DECISIONS.md`**

В файл `DECISIONS.md` после строки `## Архитектура` (перед записью от 25-05-2025) вставить новую запись (новые решения добавляются сверху раздела):

```markdown
**[25-05-2026] Действия дронов атомарны — одна команда = одна единица работы** — команды `MOVE_TO`, `MINE`, `DROP`, `CHARGE` выполняют ровно один тик действия (одна клетка / одна руда / одна единица энергии) и сразу возвращают программу в `running`. Это даёт игроку точку контроля между шагами: между «добыл первую руду» и «добыл вторую» можно вставить `IF` или другую инструкцию. Макроповедение строится через `LOOP` / `REPEAT`. Альтернатива «команда доводит работу до конца» отвергнута: она упрощает первые миссии, но закрывает дверь к интересным условным программам и делает существующие `LOOP`/`IF` декоративными.
```

Заметка по дате: спецификация написана сегодня (2026-05-25), берём эту дату как дату решения.

- [ ] **Step 2: Переместить файл фичи в `done/`**

Run:
```bash
git mv docs/features/planned/atomic-actions.md docs/features/done/atomic-actions.md
```

Затем открыть `docs/features/done/atomic-actions.md` и заменить строку `**Статус:** planned` на `**Статус:** done`.

- [ ] **Step 3: Обновить `docs/features/index.md`**

Удалить строку про `atomic-actions.md` из секции planned:

```markdown
| [atomic-actions.md](planned/atomic-actions.md) | Атомарные игровые действия | planned |
```

Добавить строку в секцию done:

```markdown
| [atomic-actions.md](done/atomic-actions.md) | Атомарные игровые действия |
```

- [ ] **Step 4: Проверить ссылки в фиче**

В перемещённом файле `docs/features/done/atomic-actions.md` в «заготовке промпта» уже есть ссылка `docs/features/done/atomic-actions.md` — она теперь корректна. Других внутренних ссылок нет.

- [ ] **Step 5: Коммит документации**

```bash
git add DECISIONS.md docs/features/done/atomic-actions.md docs/features/index.md
git status   # убедиться, что docs/features/planned/atomic-actions.md помечен как переименованный или удалён
git commit -m "$(cat <<'EOF'
docs: атомарные действия — перенос фичи в done и запись решения

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Финальная верификация

- [ ] **Step 1: Полный unit-прогон**

Run: `npm test`
Expected: всё зелёное.

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: 0 ошибок.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: успешная сборка.

- [ ] **Step 4: Smoke e2e (опционально, но желательно)**

Run: `npm run test:e2e`
Expected: regression-тесты проходят (они не проверяют миссии 1–4 на правильность поведения, только то, что canvas / sidebar / stats работают).

Если регрессионный e2e обнаруживает крах canvas / консольные ошибки — это надо чинить, иначе фича ломает прод.

- [ ] **Step 5: Запись session-репорта**

Создать `docs/sessions/2026-05-25-feature-atomic-actions.md` с краткой структурой: цель, что сделано, какие тесты обновлены, известное следствие (миссии 1–4 теперь ведут себя «странно» — это покрывается следующей фичей `missions-atomic-migration`).

- [ ] **Step 6: Финальный коммит session-репорта**

```bash
git add docs/sessions/2026-05-25-feature-atomic-actions.md
git commit -m "$(cat <<'EOF'
docs: session report — atomic actions feature

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review (заметки автора плана)

**Покрытие спецификации:**
- `MOVE_TO` → Task 1 (MovementSystem) ✓
- `MINE` → Task 2 (MiningSystem.processMining) ✓
- `DROP` → Task 2 (MiningSystem.processDrop) ✓
- `CHARGE` → Task 3 (EnergySystem, активная команда) ✓
- Пассивная зарядка не меняется → Task 3, шаги 3–4 покрывают тестами ✓
- Длительности и стоимости энергии без изменений → не трогаем `constants.ts`, в кодовых правках видно, что используются те же константы ✓
- Edge-cases (не на депозите/базе/станции, полный инвентарь, пустой депозит, полная энергия) → существующие тесты на эти случаи продолжают работать (логика выхода без `while` сохранена); CHARGE off-charger покрыт новым тестом ✓
- Интеграционный тест `LOOP { MINE }` → Task 4 ✓
- AST и интерпретатор не меняются → в плане явно зафиксировано ✓
- Запись в DECISIONS.md → Task 5 ✓
- Известное следствие (миссии 1–4) → отмечено, реализация миграции — отдельная фича (out of scope) ✓

**Возможные риски:**
- Тест `does not exceed max energy` пришлось переосмыслить (раньше он работал на активной CHARGE; теперь работает на пассивной). Это сохраняет проверяемое инвариант, но смысл теста чуть смещается. Это ОК — инвариант важнее формы.
- `program.chargeElapsed` шарится между пассивной и активной зарядкой. Если игрок стоит на станции пассивно, потом запускает `CHARGE` — накопленное время засчитается. Это не противоречит спеке («атомарная команда даёт +1 после накопления BASE_CHARGE_DURATION_PER_UNIT»), просто часть накопления может быть с пассивной фазы. Если в обзоре кода это сочтут проблемой — можно обнулять `chargeElapsed` при входе в активную CHARGE; но это меняет интерпретатор и выходит за рамки спецификации. По умолчанию оставляю как есть.

**Placeholder-scan:** TODO/TBD/«similar to»/«handle edge cases» — нет. Все шаги содержат конечный код или конкретные команды.

**Type-consistency:** имена компонентов (`Program`, `Movement`, `Energy`, `Inventory`, `Deposit`, `ChargerStation`), полей (`waitingFor`, `mineElapsed`, `dropElapsed`, `chargeElapsed`, `path`, `progress`) — взяты прямо из существующего кода, прошли по grep. Константы (`BASE_MINE_DURATION_PER_ORE`, `BASE_DROP_DURATION_PER_ORE`, `BASE_CHARGE_DURATION_PER_UNIT`, `DT`, `EPSILON`) — все импортируются из `simulation/constants.ts`.
