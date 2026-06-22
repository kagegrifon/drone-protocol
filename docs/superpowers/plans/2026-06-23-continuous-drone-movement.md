# Continuous Drone Movement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дрон движется непрерывно по сетке, пока не получит сигнал «стоп», устраняя паузу/рывки между шагами без потери возможности менять поведение между клетками.

**Architecture:** Path-following + replanning с look-ahead на 1 шаг. `MovementSystem` шагает по `path[0]`; если `path` не пуст после shift — продолжает без паузы, иначе возвращает управление программе. `CodeBehaviorDriver` на `intent moveTo(той же цели)` дописывает следующий 1 шаг в `path`, не сбрасывая `progress`; на другой цели — строит новый путь. Ранний resume на `drone:moved` даёт воркеру время дописать шаг до конца текущего.

**Tech Stack:** TypeScript, Vitest (unit), Phaser (рендер, не тестируется юнитами), pure-TS симуляция без Phaser.

## Global Constraints

- Simulation layer (`src/game/simulation/`) **никогда не импортирует Phaser**.
- Двойные кавычки, Prettier-форматирование.
- Тесты — Vitest, рядом с файлом (`*.test.ts`).
- Коммиты: русский imperative, тип `feat:`/`fix:`/`refactor:`/`test:`, в конце `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- `npm test` — unit, `npm run type-check` — типы.
- Не коммитить незавершённую работу; коммит только связанных файлов (не `git add -A`).

## Starting Point

Рабочее дерево содержит незакоммиченные правки (частичный откат `6078efc`). **Task 0 сбрасывает дерево к `6078efc`**, чтобы план стартовал от воспроизводимой базы. Спек: `docs/superpowers/specs/2026-06-23-continuous-drone-movement-design.md`.

## File Structure

- `src/game/pathfinding/planMove.ts` — добавить `planNextStep` (look-ahead на 1 шаг).
- `src/game/pathfinding/planMove.test.ts` — создать (тесты planNextStep). Если файла нет — создать.
- `src/game/simulation/systems/MovementSystem.ts` — шаг с продолжением при непустом path.
- `src/game/simulation/systems/MovementSystem.test.ts` — тесты continuous-шага.
- `src/game/code/CodeBehaviorDriver.ts` — продление пути на ту же цель; ранний resume.
- `src/game/code/CodeBehaviorDriver.test.ts` — тесты продления/смены цели.

---

### Task 0: Сброс к воспроизводимой базе

**Files:**
- Modify (reset): рабочее дерево.

- [ ] **Step 1: Сбросить незакоммиченные правки кода к 6078efc**

Сбрасываем ТОЛЬКО файлы движения, не трогая закоммиченный спек/память и docs.

Run:
```bash
git checkout 6078efc -- src/game/simulation/systems/MovementSystem.ts src/game/simulation/systems/MovementSystem.test.ts src/game/code/CodeBehaviorDriver.ts src/game/code/CodeBehaviorDriver.test.ts src/game/pathfinding/planMove.ts src/renderer/scenes/GameScene.ts
```

- [ ] **Step 2: Проверить чистоту дерева**

Run: `git status --short`
Expected: нет изменений в перечисленных файлах движения (могут оставаться несвязанные untracked-доки — это ок).

- [ ] **Step 3: Прогнать базовые тесты**

Run: `npx vitest run src/game/`
Expected: PASS (все зелёные на базе 6078efc).

---

### Task 1: planNextStep — look-ahead на 1 шаг

**Files:**
- Modify: `src/game/pathfinding/planMove.ts`
- Test: `src/game/pathfinding/planMove.test.ts` (создать, если отсутствует)

**Interfaces:**
- Consumes: `astar(grid, start, goal, occupied): Point[] | null` (возвращает путь без стартовой клетки; `[]` если start === goal).
- Produces: `planNextStep(droneId, target, world, grid, occupied): void` — планирует РОВНО следующий 1 шаг к `target`, дописывая его так, что `movement.path` содержит максимум следующую клетку. Обновляет `movement.targetX/targetY = target`. НЕ трогает `movement.progress`. Если дрон уже на цели или путь не найден — `movement.path = []`.

- [ ] **Step 1: Написать падающий тест**

Если файла `src/game/pathfinding/planMove.test.ts` нет — создать с этим содержимым; если есть — добавить блок `describe("planNextStep", ...)`.

```typescript
import { describe, it, expect } from "vitest";
import { World } from "../simulation/world/World.js";
import { Grid } from "../simulation/world/Grid.js";
import { planNextStep } from "./planMove.js";

function addDroneAt(world: World, x: number, y: number) {
  const id = world.createEntity();
  world.addComponent(id, "Position", { x, y });
  world.addComponent(id, "Movement", {
    targetX: x,
    targetY: y,
    path: [],
    progress: 0.4,
    speed: 1,
  });
  return id;
}

describe("planNextStep", () => {
  const grid = new Grid();
  const occupied = new Set<string>();

  it("plans exactly the next single cell toward the target", () => {
    const world = new World();
    const id = addDroneAt(world, 0, 0);
    planNextStep(id, { x: 3, y: 0 }, world, grid, occupied);
    const m = world.getComponent(id, "Movement")!;
    expect(m.path).toEqual([{ x: 1, y: 0 }]); // только следующий шаг
    expect(m.targetX).toBe(3);
    expect(m.targetY).toBe(0);
  });

  it("does NOT reset progress (continues smoothly)", () => {
    const world = new World();
    const id = addDroneAt(world, 0, 0);
    planNextStep(id, { x: 3, y: 0 }, world, grid, occupied);
    const m = world.getComponent(id, "Movement")!;
    expect(m.progress).toBe(0.4); // прогресс сохранён
  });

  it("sets empty path when already at the target", () => {
    const world = new World();
    const id = addDroneAt(world, 2, 2);
    planNextStep(id, { x: 2, y: 2 }, world, grid, occupied);
    const m = world.getComponent(id, "Movement")!;
    expect(m.path).toEqual([]);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/game/pathfinding/planMove.test.ts`
Expected: FAIL — `planNextStep is not a function` / нет экспорта.

- [ ] **Step 3: Реализовать planNextStep**

Добавить в `src/game/pathfinding/planMove.ts` (рядом с `planMoveToPoint`, после импортов уже есть `astar`):

```typescript
/**
 * Планирует РОВНО следующий 1 шаг дрона к точке (look-ahead). В отличие от
 * planMoveToPoint НЕ сбрасывает progress — используется для непрерывного
 * движения, когда цель не меняется и дрон продолжает идти без остановки.
 */
export function planNextStep(
  droneId: EntityId,
  target: Position,
  world: World,
  grid: Grid,
  occupied: Set<string>,
): void {
  const dronePos = world.getComponent(droneId, "Position");
  const movement = world.getComponent(droneId, "Movement");
  if (!dronePos || !movement) return;
  movement.targetX = target.x;
  movement.targetY = target.y;
  const path = astar(grid, dronePos, target, occupied);
  // astar возвращает путь без стартовой клетки; [] если уже на цели; null если не найден.
  movement.path = path && path.length > 0 ? [path[0]] : [];
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/game/pathfinding/planMove.test.ts`
Expected: PASS (все тесты planNextStep зелёные).

- [ ] **Step 5: Type-check и коммит**

Run: `npm run type-check`
Expected: без ошибок.

```bash
git add src/game/pathfinding/planMove.ts src/game/pathfinding/planMove.test.ts
git commit -m "feat: planNextStep — look-ahead планирование одного шага к цели

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: MovementSystem — продолжение движения при непустом path

**Files:**
- Modify: `src/game/simulation/systems/MovementSystem.ts` (блок после `movement.path.shift()`)
- Test: `src/game/simulation/systems/MovementSystem.test.ts`

**Interfaces:**
- Consumes: ничего нового.
- Produces: поведение MovementSystem — после шага `path.shift()`; если `path` НЕ пуст → `progress=0`, `state` остаётся `move`, движение продолжается; если `path` пуст → `progress=0`, `state` (если был `move`) → `running`.

> Примечание: на базе `6078efc` `MovementSystem` уже делает `path.shift()` (не `path=[]`). Нужно изменить условие возврата `state=running`, чтобы оно срабатывало ТОЛЬКО при пустом path. Это совпадает с целевой continuous-моделью: look-ahead держит path с ≤1 элементом, поэтому «path не пуст после shift» означает «driver успел дописать следующий шаг».

- [ ] **Step 1: Написать падающий тест**

Добавить в `MovementSystem.test.ts` в блок `describe("MovementSystem", ...)` (рядом с тестом `"does not resume program if state is not move"`):

```typescript
  it("continues moving (state=move) when path still has a look-ahead step", () => {
    // path с look-ahead: после shift остаётся следующий шаг (driver дописал).
    // state остаётся move → MovementSystem продолжит вести дрон без паузы.
    const id = addDrone(
      world,
      0,
      0,
      [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      10,
    );
    system.update();
    const program = world.getComponent(id, "Program")!;
    expect(program.state).toBe("move");
    expect(world.getComponent(id, "Movement")!.path).toEqual([{ x: 2, y: 0 }]);
  });

  it("resumes program (state=running) when path becomes empty after the step", () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10);
    system.update();
    const program = world.getComponent(id, "Program")!;
    expect(program.state).toBe("running");
    expect(world.getComponent(id, "Movement")!.path).toEqual([]);
  });
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/game/simulation/systems/MovementSystem.test.ts`
Expected: FAIL на `"continues moving..."` — `expected 'running' to be 'move'` (на базе 6078efc state переключается в running безусловно).

- [ ] **Step 3: Изменить условие resume в MovementSystem**

В `src/game/simulation/systems/MovementSystem.ts` найти блок после `movement.path.shift()` (присвоение position, energy, progress). Заменить:

```typescript
      energy.current = Math.max(0, energy.current - energy.drainPerMove);
      movement.progress = 0;

      if (program.state === "move") {
        program.state = "running";
      }
```

на:

```typescript
      energy.current = Math.max(0, energy.current - energy.drainPerMove);
      movement.progress = 0;

      // Continuous movement: если driver успел дописать следующий шаг (look-ahead),
      // path не пуст — продолжаем движение, state остаётся move. Если path пуст —
      // известный путь исчерпан, возвращаем управление программе (безопасная
      // остановка на клетке). См. спек continuous-drone-movement.
      if (program.state === "move" && movement.path.length === 0) {
        program.state = "running";
      }
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/game/simulation/systems/MovementSystem.test.ts`
Expected: PASS. Если падают старые тесты, опиравшиеся на «дрон идёт весь путь сам» (например `"drone with 3-cell path reaches target in 30 ticks"`) — они описывают модель 6078efc, которой больше нет. Обновить их в Step 5.

- [ ] **Step 5: Обновить устаревшие тесты многошаговой модели**

В `MovementSystem.test.ts` тесты, проверявшие что MovementSystem самостоятельно проходит весь многоклеточный path (`"moves drone along full 2-cell path in 20 ticks"`, `"drone with 3-cell path reaches target in 30 ticks without stopping"`, `"keeps remaining path after one step..."`), теперь некорректны: в continuous-модели path продлевается driver-ом, а не пройден симуляцией слепо. Заменить их семантику на «MovementSystem делает один шаг за раз, продолжая пока path непуст»:

Заменить тест `"keeps remaining path after one step so drone continues without pause"` на:
```typescript
  it("steps one cell at a time, continuing while path is non-empty", () => {
    const id = addDrone(
      world,
      0,
      0,
      [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
      10,
    );
    system.update();
    expect(world.getComponent(id, "Position")!.x).toBe(1);
    expect(world.getComponent(id, "Movement")!.path).toEqual([
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
    expect(world.getComponent(id, "Program")!.state).toBe("move");
  });
```

Тесты `"moves drone along full 2-cell path in 20 ticks at speed=1"` и `"drone with 3-cell path reaches target in 30 ticks without stopping"` оставить как есть, если они проходят (MovementSystem всё ещё ведёт дрон по уже заданному path; продление делает driver, но в этих тестах path задан заранее и просто потребляется по шагу). Если падают на проверке state в конце — скорректировать ожидание state на финальном шаге (`running` когда path опустел).

- [ ] **Step 6: Прогнать весь файл и type-check**

Run: `npx vitest run src/game/simulation/systems/MovementSystem.test.ts && npm run type-check`
Expected: PASS, типы чистые.

- [ ] **Step 7: Коммит**

```bash
git add src/game/simulation/systems/MovementSystem.ts src/game/simulation/systems/MovementSystem.test.ts
git commit -m "feat: MovementSystem продолжает движение при непустом path (continuous)

state возвращается в running только когда look-ahead path исчерпан.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: CodeBehaviorDriver — продление пути на ту же цель

**Files:**
- Modify: `src/game/code/CodeBehaviorDriver.ts` (обработчик `onDroneMoved` и ветка `intent: moveTo`)
- Test: `src/game/code/CodeBehaviorDriver.test.ts`

**Interfaces:**
- Consumes: `planNextStep(droneId, target, world, grid, occupied)` из Task 1; `planMoveToPoint(...)` существующий.
- Produces: при `intent moveTo(point)` — если `point` совпадает с `movement.targetX/targetY` И дрон в движении (path непуст или только что шагнул) → `planNextStep` (продление, progress не сбрасывается); иначе → `planMoveToPoint` (новый путь). Ранний resume на `drone:moved` шлётся всегда для moveTo (path после шага пуст в момент события).

- [ ] **Step 1: Написать падающий тест продления на ту же цель**

Добавить в `CodeBehaviorDriver.test.ts` (внутри `describe("CodeBehaviorDriver", ...)`):

```typescript
  it("extends path with a single look-ahead step when moveTo targets the same point", async () => {
    // Дрон едет к {x:3,y:0}. На drone:moved (path пуст после шага) приходит ранний
    // resume, воркер снова шлёт moveTo к ТОЙ ЖЕ цели → driver должен дописать
    // следующий шаг через planNextStep, НЕ сбрасывая progress.
    const mine = world.createEntity();
    world.addComponent(mine, "Position", { x: 3, y: 0 });
    world.addComponent(mine, "Deposit", { oreRemaining: 5, mineRate: 1 });
    const typeMap = new Map<number, WorldObjectType>([[mine, "mine"]]);
    driver = new CodeBehaviorDriver({
      createPort: () => new NodeWorkerPort(),
      timeoutMs: 1000,
      typeMap,
    });

    const { id: drone, registry } = addDrone(
      world,
      "while (true) { await self.moveTo(World.mines[0].position); }",
    );

    await tickUntil(
      driver,
      drone,
      world,
      registry,
      () => world.getComponent(drone, "Program")!.state === "move",
    );

    // Симулируем шаг MovementSystem: дрон шагнул в (1,0), path пуст, state=running.
    world.getComponent(drone, "Position")!.x = 1;
    world.getComponent(drone, "Movement")!.path = [];
    world.getComponent(drone, "Movement")!.progress = 0;
    world.getComponent(drone, "Program")!.state = "running";
    gameEvents.emit("drone:moved", {
      droneId: drone,
      fromX: 0,
      fromY: 0,
      toX: 1,
      toY: 0,
    });

    await new Promise((r) => setTimeout(r, 50));
    driver.step(drone, ctx(world, registry));

    // Та же цель → driver дописал следующий шаг к (3,0): следующий шаг (2,0).
    const m = world.getComponent(drone, "Movement")!;
    expect(m.targetX).toBe(3);
    expect(m.path).toEqual([{ x: 2, y: 0 }]);
    expect(world.getComponent(drone, "Program")!.state).toBe("move");
  });
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/game/code/CodeBehaviorDriver.test.ts -t "extends path"`
Expected: FAIL — на базе 6078efc приходит полный путь через planMoveToPoint, `m.path` не равно `[{x:2,y:0}]` (будет `[{x:2,y:0},{x:3,y:0}]`) либо state не `move`.

- [ ] **Step 3: Изменить onDroneMoved — убрать проверку path.length, ранний resume всегда**

В `src/game/code/CodeBehaviorDriver.ts` в `this.onDroneMoved` удалить блок:

```typescript
      // Если в path ещё есть шаги — дрон продолжает идти без остановки,
      // resume пока не нужен (MovementSystem сам ведёт по пути).
      const movement = session.world.getComponent(droneId, "Movement");
      if (movement && movement.path.length > 0) return;

      // Путь пройден — позиция обновлена, снапшот корректен.
```

заменив на:

```typescript
      // moveTo = «умный шаг»: один шаг завершён (path пуст в момент события),
      // позиция обновлена. Шлём ранний resume сразу (~15ms) — воркер успевает
      // вернуть новый intent до конца следующего шага, дрон не тормозит.
```

(Строки `session.phase = "idle"; session.port.postMessage({ type: "resume", ... })` остаются.)

- [ ] **Step 4: Изменить ветку intent moveTo — продление на ту же цель**

В методе `step`, в `switch (msg.type)` → `case "intent"` → ветка `if (msg.action === "moveTo")`, заменить:

```typescript
        if (msg.action === "moveTo") {
          if (msg.point !== undefined) {
            planMoveToPoint(
              droneId,
              msg.point,
              ctx.world,
              ctx.grid,
              ctx.occupied,
            );
          }
          program.state = "move";
          session.lastAction = "moveTo";
        }
```

на:

```typescript
        if (msg.action === "moveTo") {
          if (msg.point !== undefined) {
            const movement = ctx.world.getComponent(droneId, "Movement");
            const sameTarget =
              movement !== undefined &&
              movement.targetX === msg.point.x &&
              movement.targetY === msg.point.y;
            // Та же цель и дрон уже двигался к ней (lastAction moveTo) → продлеваем
            // путь одним look-ahead шагом, не сбрасывая progress (непрерывность).
            // Иначе — строим новый путь (смена цели или старт движения).
            if (sameTarget && session.lastAction === "moveTo") {
              planNextStep(
                droneId,
                msg.point,
                ctx.world,
                ctx.grid,
                ctx.occupied,
              );
            } else {
              planMoveToPoint(
                droneId,
                msg.point,
                ctx.world,
                ctx.grid,
                ctx.occupied,
              );
            }
          }
          program.state = "move";
          session.lastAction = "moveTo";
        }
```

Добавить импорт `planNextStep` рядом с `planMoveToPoint`:

```typescript
import { planMoveToPoint, planNextStep } from "../pathfinding/planMove.js";
```

> Замечание: при первом moveTo `movement.targetX/targetY` ещё хранят старую/начальную цель. `lastAction` при первом intent === `null` (ещё не moveTo), поэтому ветка `sameTarget && lastAction==="moveTo"` не сработает на старте — пойдёт `planMoveToPoint`. Это корректно: первый шаг всегда через полный план.

- [ ] **Step 5: Запустить целевой тест**

Run: `npx vitest run src/game/code/CodeBehaviorDriver.test.ts -t "extends path"`
Expected: PASS.

- [ ] **Step 6: Прогнать весь файл драйвера**

Run: `npx vitest run src/game/code/CodeBehaviorDriver.test.ts`
Expected: PASS. Тест `"early resume on drone:moved: ONE step()..."` должен пройти (path пуст после шага → ранний resume, как и было). Если тест `"drone:blocked suppresses early resume..."` падает — проверить, что флаг `blocked` всё ещё подавляет resume (логика не менялась).

- [ ] **Step 7: Обновить устаревшие тесты, если есть**

Если какой-то тест опирался на «полный путь сохраняется в movement.path после moveTo» (модель 6078efc), скорректировать ожидание: после продления path содержит ≤1 шаг. Проверить тест `"await self.moveTo(...) plans a path via planMoveToPoint"` — он проверяет `path.length > 0` на ПЕРВОМ moveTo (через planMoveToPoint, полный путь) — должен пройти без изменений.

- [ ] **Step 8: Type-check и коммит**

Run: `npm run type-check`
Expected: чисто.

```bash
git add src/game/code/CodeBehaviorDriver.ts src/game/code/CodeBehaviorDriver.test.ts
git commit -m "feat: CodeBehaviorDriver продлевает путь на ту же цель (continuous)

intent moveTo к той же target → planNextStep (look-ahead, без сброса progress);
другая цель → planMoveToPoint. Ранний resume на drone:moved всегда для moveTo.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Полная проверка и визуальная верификация

**Files:**
- Нет изменений кода (только запуск).

- [ ] **Step 1: Прогнать весь unit-набор**

Run: `npm test`
Expected: все тесты зелёные.

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: без ошибок.

- [ ] **Step 3: Запустить игру и визуально проверить**

Run: `npm run dev` (в фоне), открыть браузер.
Проверить вручную:
- Дрон с кодом `while(true){ await self.moveTo(World.mines[0].position); }` едет к шахте **плавно, без пауз на каждой клетке и без рывков назад**.
- При смене цели на лету (если есть условие в коде) — плавный разворот со следующей клетки.
- При действии mine/charge — дрон останавливается ровно на клетке.

Использовать skill `verify` для захвата скриншота/наблюдения как evidence.

- [ ] **Step 4: Финальный коммит документации сессии**

Создать `docs/sessions/2026-06-23-<время>-fix-continuous-drone-movement.md`: цель (устранить дёрганость, сохранив пересчёт поведения), что сделано (continuous-модель, look-ahead, ранний resume), итог. Закоммитить отдельно (`docs:`).

---

## Self-Review

**Spec coverage:**
- Целевая модель continuous → Task 2 (MovementSystem) + Task 3 (Driver). ✓
- Сигнал стоп (другая цель / не-move / нет подтверждения) → Task 3 (sameTarget ветка) + Task 2 (пустой path → running). ✓
- Критерий «та же траектория» по target → Task 3 Step 4 (`movement.targetX/Y === msg.point`). ✓
- Look-ahead на 1 шаг → Task 1 (planNextStep) + Task 3 (вызов). ✓
- Ранний resume устраняет паузу → Task 3 Step 3. ✓
- Cold start → дрон стоит → Task 2 (пустой path → running, дрон на клетке). ✓
- Граничные: blocked → Task 3 Step 6 (флаг blocked сохранён); не-move → ранний resume не шлётся (lastAction !== moveTo проверка в onDroneMoved сохранена). ✓
- Вне scope (Path, подсветка, deceleration) → не планируются. ✓

**Placeholder scan:** нет TBD/TODO; весь код приведён целиком. Task 2 Step 5 содержит условную формулировку «если падают» — это допустимо, т.к. зависит от фактического состояния существующих тестов на базе 6078efc, и даёт конкретное действие для каждого исхода. ✓

**Type consistency:** `planNextStep(droneId, target, world, grid, occupied): void` — сигнатура одинакова в Task 1 (определение), Task 3 (вызов), импорте. `movement.targetX/targetY` — consistent. `astar` возвращает путь без стартовой клетки — учтено в planNextStep (`path[0]`). ✓
