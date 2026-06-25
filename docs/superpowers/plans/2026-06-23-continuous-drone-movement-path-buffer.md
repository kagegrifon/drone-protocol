# Continuous Drone Movement via Path Buffer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дрон, чей код в цикле подряд вызывает `moveTo` к одной цели, движется плавно без пауз; при этом поведение пересчитывается между шагами (смена цели / переход к действию работают).

**Architecture:** `path` хранит весь маршрут до цели. `MovementSystem` каждый шаг делает `shift()` при `progress>=1` — пока `path` непуст, дрон едет без паузы (уже реализовано, **НЕ меняем**). После шага driver получает ранний resume на `drone:moved`; воркер пересчитывает поведение и шлёт `moveTo` к той же цели → driver **пересчитывает хвост от `path[0]`** (клетки, в которую дрон уже физически едет с накопленным progress) и собирает `path = [path[0], ...newTail]`. `path[0]` и `progress` не трогаются → нет рывка; при той же цели путь идентичен. Так воркеру даётся фора в целый шаг, async-задержка границы потоков прячется. Снапшот для воркера показывает дрона в `path[0]` («на шаг вперёд»), чтобы A* в `moveTo` стартовал от клетки, до которой дрон обязан доехать.

**Tech Stack:** TypeScript, Vitest (unit), Playwright (e2e), A* (`src/game/pathfinding/astar.ts`).

## Global Constraints

- Simulation layer (`src/game/simulation/`, `src/game/pathfinding/`, `src/game/code/`) **никогда не импортирует Phaser**.
- `astar(grid, start, goal, occupied)` возвращает путь **без стартовой клетки**; `[]` если start === goal; `null` если цель недостижима.
- `MovementComponent`: `{ targetX, targetY, path: Position[], progress, speed }`.
- `Position` = `{ x: number, y: number }`.
- `MovementSystem` делает `path.shift()` в момент завершения шага (`progress>=1`), затем эмитит `drone:moved`. На момент раннего resume `position` = только что достигнутая клетка, `path[0]` = следующая клетка (куда дрон уже едет). **MovementSystem не меняется этим планом.**
- Тесты — рядом с файлом (`*.test.ts`), Vitest. Команда: `npm test`.
- Коммиты: русский imperative, тип `feat:`/`fix:`/`refactor:`. Не `git add -A` — добавлять только файлы задачи.
- Ветка: `fix/jerky-drone-movement` (уже активна). Не пушить, не создавать PR — это делает пользователь.
- **Верификация в игре обязательна** (unit-тесты проходили и в провалившихся попытках). После реализации — запросить у пользователя `npm run dev` + проверку в браузере.

## Вне scope (будущие заметки, НЕ реализуем здесь)

- **Очередь операций / отложенное действие** при не-move intent с непустым `path` (граничный случай: игрок руками вызвал `mine` посреди дороги). В основном кейсе `mine` приходит уже при пустом `path` — проблемы нет. Будущая фича: driver держит очередь интентов, не шлёт resume пока занят.
- **Резервирование клетки «за шаг до»** для коллизий двух дронов. Текущая пошаговая защита (`stepped`-set в MovementSystem: кто первый шагнул — тот занял) работает и с буфером — буфер её не ломает. Резервирование — отдельный апгрейд.

---

### Task 1: Функция `extendPathTail` — пересчёт хвоста от `path[0]`

**Files:**
- Modify: `src/game/pathfinding/planMove.ts`
- Test: `src/game/pathfinding/planMove.test.ts`

**Interfaces:**
- Consumes: `astar(grid, start, goal, occupied)` из `./astar.js`; `MovementComponent`, `Position` через `world.getComponent(droneId, ...)`.
- Produces: `extendPathTail(droneId: EntityId, target: Position, world: World, grid: Grid, occupied: Set<string>): void`
  - Если `movement.path` непуст: пусть `head = movement.path[0]`. A* считается **от `head`** к `target` → `newTail`. Результат: `movement.path = [head, ...newTail]`. (`head` — клетка, в которую дрон уже едет; не трогаем её и не трогаем `progress`. При той же цели `path` идентичен прежнему; при смене направления хвост перестраивается со следующей клетки.)
  - Если `movement.path` пуст: A* **от позиции дрона** к `target` → `path`; `movement.path = path` целиком (как `planMoveToPoint`, но **без сброса** `progress`). Это cold-start ветка для continuous — но в driver этот случай обычно идёт через `planMoveToPoint`; здесь поддержан для полноты/прямых вызовов.
  - Всегда обновляет `movement.targetX/targetY = target.x/target.y`.
  - Если A* вернул `null` (недостижимо) — `path` оставляем как есть (не обрываем текущее движение). Если `[]` (head/позиция уже === target) — `path` = `[head]` (непустой path) либо `[]` (пустой path).

- [ ] **Step 1: Написать падающие тесты**

В `src/game/pathfinding/planMove.test.ts` заменить строку импорта на:

```typescript
import { planMoveToPoint, planNextStep, extendPathTail } from "./planMove.js";
```

Добавить в конец файла:

```typescript
describe("extendPathTail", () => {
  const grid = new Grid();
  const occupied = new Set<string>();

  it("recomputes tail from path[0], keeping path[0] and producing identical path for same target", () => {
    const world = new World();
    const id = world.createEntity();
    world.addComponent(id, "Position", { x: 0, y: 0 });
    world.addComponent(id, "Movement", {
      targetX: 4,
      targetY: 0,
      // дрон едет в (1,0); за ним накопленный буфер до (4,0)
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ],
      progress: 0.3,
      speed: 1,
    });

    extendPathTail(id, { x: 4, y: 0 }, world, grid, occupied);

    const m = world.getComponent(id, "Movement")!;
    // A* от path[0]=(1,0) к (4,0) → newTail [2,0 3,0 4,0]; path = [1,0, ...newTail]
    expect(m.path).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
  });

  it("does NOT touch path[0] and does NOT reset progress", () => {
    const world = new World();
    const id = world.createEntity();
    world.addComponent(id, "Position", { x: 0, y: 0 });
    world.addComponent(id, "Movement", {
      targetX: 5,
      targetY: 0,
      path: [{ x: 1, y: 0 }],
      progress: 0.7,
      speed: 1,
    });

    extendPathTail(id, { x: 5, y: 0 }, world, grid, occupied);

    const m = world.getComponent(id, "Movement")!;
    expect(m.path[0]).toEqual({ x: 1, y: 0 }); // первая клетка цела
    expect(m.progress).toBe(0.7); // progress не сброшен
    // полный путь от (1,0) к (5,0): [1,0 2,0 3,0 4,0 5,0]
    expect(m.path).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 5, y: 0 },
    ]);
  });

  it("rebuilds the tail from path[0] toward a CHANGED target (smooth turn)", () => {
    const world = new World();
    const id = world.createEntity();
    world.addComponent(id, "Position", { x: 0, y: 0 });
    world.addComponent(id, "Movement", {
      targetX: 4,
      targetY: 0,
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ],
      progress: 0.5,
      speed: 1,
    });

    // новая цель (1,2): дрон сперва доедет path[0]=(1,0), затем повернёт
    extendPathTail(id, { x: 1, y: 2 }, world, grid, occupied);

    const m = world.getComponent(id, "Movement")!;
    expect(m.path[0]).toEqual({ x: 1, y: 0 }); // path[0] сохранён — нет рывка
    expect(m.path[m.path.length - 1]).toEqual({ x: 1, y: 2 }); // ведёт к новой цели
    expect(m.targetX).toBe(1);
    expect(m.targetY).toBe(2);
    expect(m.progress).toBe(0.5);
  });

  it("plans from drone position when path is empty (no progress reset)", () => {
    const world = new World();
    const id = world.createEntity();
    world.addComponent(id, "Position", { x: 0, y: 0 });
    world.addComponent(id, "Movement", {
      targetX: 0,
      targetY: 0,
      path: [],
      progress: 0.4,
      speed: 1,
    });

    extendPathTail(id, { x: 3, y: 0 }, world, grid, occupied);

    const m = world.getComponent(id, "Movement")!;
    expect(m.path).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
    expect(m.progress).toBe(0.4); // progress сохранён
    expect(m.targetX).toBe(3);
  });

  it("keeps existing path when target is unreachable (does not break movement)", () => {
    const world = new World();
    const blockedGrid = new Grid();
    // Стена-ловушка вокруг (5,0) — недостижимо
    blockedGrid.setTile(4, 0, "wall");
    blockedGrid.setTile(5, 1, "wall");
    blockedGrid.setTile(6, 0, "wall");
    blockedGrid.setTile(5, -1, "wall");
    blockedGrid.setTile(5, 0, "wall");
    const id = world.createEntity();
    world.addComponent(id, "Position", { x: 0, y: 0 });
    world.addComponent(id, "Movement", {
      targetX: 9,
      targetY: 9,
      path: [{ x: 1, y: 0 }],
      progress: 0.2,
      speed: 1,
    });

    extendPathTail(id, { x: 5, y: 0 }, world, blockedGrid, new Set());

    const m = world.getComponent(id, "Movement")!;
    // путь не оборван — дрон продолжает ехать в path[0]
    expect(m.path).toEqual([{ x: 1, y: 0 }]);
  });
});
```

- [ ] **Step 2: Запустить тесты — убедиться, что падают**

Run: `npm test -- planMove`
Expected: FAIL — `extendPathTail is not a function` / нет экспорта.

- [ ] **Step 3: Реализовать `extendPathTail`**

Добавить в `src/game/pathfinding/planMove.ts` (после `planNextStep`, перед `planMoveToPoint`):

```typescript
/**
 * Пересчитывает хвост пути от path[0] к цели (буфер пути для continuous-
 * движения). path[0] — клетка, в которую дрон уже физически едет с накопленным
 * progress; её и progress НЕ трогаем (нет рывка). A* считается ОТ path[0] к
 * цели, результат склеивается: path = [path[0], ...newTail]. При той же цели
 * путь остаётся идентичным; при смене направления хвост перестраивается со
 * следующей клетки. Если буфер пуст — планируем от позиции дрона (cold-start),
 * progress тоже не сбрасываем. Используется, когда воркер прислал moveTo, а
 * дрон должен продолжать движение без паузы. См. спек «РЕВИЗИЯ 2026-06-23».
 */
export function extendPathTail(
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

  if (movement.path.length > 0) {
    const head = movement.path[0];
    const tail = astar(grid, head, target, occupied);
    // null → недостижимо: не обрываем текущее движение, path как есть.
    if (tail !== null) {
      movement.path = [head, ...tail];
    }
  } else {
    const path = astar(grid, dronePos, target, occupied);
    if (path !== null) {
      movement.path = path;
    }
  }
}
```

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

Run: `npm test -- planMove`
Expected: PASS (все тесты `planMoveToPoint`, `planNextStep`, `extendPathTail`).

- [ ] **Step 5: Коммит**

```bash
git add src/game/pathfinding/planMove.ts src/game/pathfinding/planMove.test.ts
git commit -m "feat: extendPathTail — пересчёт хвоста пути от path[0]"
```

---

### Task 2: Снапшот «на шаг вперёд» — позиция дрона = path[0]

**Files:**
- Modify: `src/game/code/worldSnapshot.ts:12-26` (`droneSnap`)
- Test: `src/game/code/worldSnapshot.test.ts`

**Interfaces:**
- Consumes: `world.getComponent(id, "Movement")` (поле `path: Position[]`).
- Produces: `droneSnap` отдаёт `position = path[0]` если `movement.path` непуст, иначе текущую `Position`. Касается `self` и всех дронов в `drones[]` (консистентно). Энергия/инвентарь не меняются.
- **Зачем:** на момент раннего resume `Position` = только что достигнутая клетка, а дрон уже едет в `path[0]`. Код, считающий `moveTo`/`distanceTo`, должен видеть клетку, до которой дрон обязан доехать, иначе A* стартует на шаг позади.

- [ ] **Step 1: Написать падающий тест**

Добавить в `describe("collectWorld", ...)` в `src/game/code/worldSnapshot.test.ts`:

```typescript
  it("reports self.position as path[0] when the drone is mid-move (look-ahead snapshot)", () => {
    const world = new World();
    const drone = makeDrone(world, 0, 0);
    // дрон физически в (0,0), но уже едет в (1,0) — буфер пути
    world.getComponent(drone, "Movement")!.path = [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];

    const snap = collectWorld(world, drone, new Map());

    // снапшот «на шаг вперёд»: позиция = клетка, в которую дрон едет
    expect(snap.self.position).toEqual({ x: 1, y: 0 });
  });

  it("reports self.position as current Position when path is empty", () => {
    const world = new World();
    const drone = makeDrone(world, 3, 4); // path по умолчанию []

    const snap = collectWorld(world, drone, new Map());

    expect(snap.self.position).toEqual({ x: 3, y: 4 });
  });

  it("applies look-ahead position to OTHER drones in drones[] too", () => {
    const world = new World();
    const self = makeDrone(world, 0, 0);
    const other = makeDrone(world, 4, 4);
    world.getComponent(other, "Movement")!.path = [{ x: 5, y: 4 }];

    const snap = collectWorld(world, self, new Map());

    const otherSnap = snap.drones.find((d) => d.id === other)!;
    expect(otherSnap.position).toEqual({ x: 5, y: 4 });
  });
```

- [ ] **Step 2: Запустить тесты — убедиться, что новые падают**

Run: `npm test -- worldSnapshot`
Expected: FAIL — `position` сейчас всегда из `Position` (0,0)/(4,4), а не из `path[0]`.

- [ ] **Step 3: Реализовать look-ahead в `droneSnap`**

Заменить `droneSnap` в `src/game/code/worldSnapshot.ts` (строки 12-26):

```typescript
function droneSnap(world: World, id: EntityId): DroneSnap | null {
  const pos = world.getComponent(id, "Position");
  if (!pos) return null;
  const energy = world.getComponent(id, "Energy");
  const inventory = world.getComponent(id, "Inventory");
  // Look-ahead: если дрон в движении (path непуст), показываем клетку, в
  // которую он едет (path[0]) — код считает moveTo от клетки, до которой дрон
  // обязан доехать. На момент раннего resume Position = уже достигнутая клетка,
  // path[0] = следующая. См. спек continuous-drone-movement (снапшот «на шаг
  // вперёд»).
  const movement = world.getComponent(id, "Movement");
  const cell =
    movement && movement.path.length > 0 ? movement.path[0] : pos;
  return {
    id,
    type: "drone",
    position: { x: cell.x, y: cell.y },
    energy: energy?.current ?? 0,
    energyMax: energy?.max ?? 0,
    inventory: inventory?.ore ?? 0,
    inventoryMax: inventory?.capacity ?? 0,
  };
}
```

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

Run: `npm test -- worldSnapshot`
Expected: PASS — новые look-ahead тесты + все существующие (они используют `path: []` → возвращается текущая позиция, поведение не изменилось).

- [ ] **Step 5: Коммит**

```bash
git add src/game/code/worldSnapshot.ts src/game/code/worldSnapshot.test.ts
git commit -m "feat: снапшот воркера показывает дрона в path[0] (look-ahead)"
```

---

### Task 3: CodeBehaviorDriver — ветка moveTo с буфером пути

**Files:**
- Modify: `src/game/code/CodeBehaviorDriver.ts` (импорт строка 4; ветка moveTo строки ~193-210)
- Test: `src/game/code/CodeBehaviorDriver.test.ts`

**Interfaces:**
- Consumes: `extendPathTail` и `planMoveToPoint` из `../pathfinding/planMove.js`. `movement.targetX/targetY`, `movement.path`.
- Produces: поведение driver на `intent moveTo(point)`:
  - **Та же цель** (`movement.targetX === point.x && movement.targetY === point.y`) **и** `movement.path.length > 0` → `extendPathTail` (пересчёт хвоста от `path[0]`; `path[0]`/progress целы; при той же цели путь идентичен).
  - **Иначе** (другая цель, либо `path` пуст = дрон стоит / cold start) → `planMoveToPoint` (новый путь от позиции дрона, сбрасывает progress — корректно для старта движения; для разворота — мы уже доехали path[0] или стоим).
  - Не-move intent (`mine`/`drop`/`charge`) — **без изменений**, как сейчас (немедленное применение state). Граничный случай «доехать перед действием» — вне scope (см. секцию выше).

**Контекст:** сейчас (строки ~193-210) ветка moveTo вызывает `planNextStep(droneId, msg.point, ...)` всегда — это провалившаяся single-step модель (фора 0). Заменяем на логику буфера.

- [ ] **Step 1: Обновить существующий тест "continuous via repeated single steps" под модель буфера**

В `src/game/code/CodeBehaviorDriver.test.ts` тест на строках ~271-319 (`plans the next single step after each moveTo`) симулирует шаг с `path = []` и проверяет `path === [{x:2,y:0}]`. При пустом path новая модель идёт через `planMoveToPoint` (от позиции (1,0) к цели (3,0)) → `path` станет весь путь `[{x:2,y:0},{x:3,y:0}]`. Обновить ассерты и название/комментарий теста.

Заменить весь этот тест (от `it("plans the next single step after each moveTo` до его `});`) на:

```typescript
  it("rebuilds full path from position when worker re-sends moveTo and buffer is empty", async () => {
    // Дрон «встал» (path пуст) после шага в (1,0). Воркер на раннем resume снова
    // шлёт moveTo к (3,0) → буфер пуст → driver строит новый путь от позиции
    // (planMoveToPoint): весь маршрут [2,0 3,0]. Так continuous-движение
    // возобновляется после остановки.
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

    // Симулируем шаг MovementSystem: дрон в (1,0), path пуст, state=running.
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

    const m = world.getComponent(drone, "Movement")!;
    expect(m.targetX).toBe(3);
    // буфер был пуст → полный путь от (1,0) к (3,0)
    expect(m.path).toEqual([
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
    expect(world.getComponent(drone, "Program")!.state).toBe("move");
  });
```

- [ ] **Step 2: Добавить новый тест — пересчёт хвоста при той же цели и непустом буфере**

Добавить в `describe("CodeBehaviorDriver", ...)` (перед закрывающей `});` файла):

```typescript
  it("recomputes the tail from path[0] (identical for same target) when worker re-sends moveTo mid-move", async () => {
    // Дрон в движении: path=[2,0 3,0 4,0 5,0] к цели (5,0), progress накоплен.
    // Воркер на раннем resume снова шлёт moveTo к (5,0) → driver пересчитывает
    // хвост от path[0]=(2,0): путь идентичен, path[0] и progress целы.
    const mine = world.createEntity();
    world.addComponent(mine, "Position", { x: 5, y: 0 });
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

    // Состояние «дрон в движении»: буфер непуст, progress накоплен, цель (5,0).
    world.getComponent(drone, "Position")!.x = 1;
    const mv = world.getComponent(drone, "Movement")!;
    mv.path = [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 5, y: 0 },
    ];
    mv.progress = 0.5;
    mv.targetX = 5;
    mv.targetY = 0;
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

    const m = world.getComponent(drone, "Movement")!;
    // Хвост пересчитан от path[0]=(2,0) к (5,0): путь идентичен.
    expect(m.path).toEqual([
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 5, y: 0 },
    ]);
    expect(m.progress).toBe(0.5); // progress не сброшен — нет рывка
    expect(world.getComponent(drone, "Program")!.state).toBe("move");
  });

  it("rebuilds path through path[0] when worker sends moveTo to a DIFFERENT target", async () => {
    // Код шлёт moveTo к (1,3) — другая цель, чем накопленная (5,0). Дрон в
    // движении (path непуст) → planMoveToPoint от позиции дрона. (path[0]
    // не сохраняется в этой ветке — это смена цели; плавность поворота
    // обеспечивается тем, что в реале позиция дрона = path[0] из-за снапшота.)
    driver = new CodeBehaviorDriver({
      createPort: () => new NodeWorkerPort(),
      timeoutMs: 1000,
    });

    const { id: drone, registry } = addDrone(
      world,
      "while (true) { await self.moveTo({ x: 1, y: 3 }); }",
    );

    await tickUntil(
      driver,
      drone,
      world,
      registry,
      () => world.getComponent(drone, "Program")!.state === "move",
    );

    // Дрон в движении к старой цели (5,0), буфер непуст.
    world.getComponent(drone, "Position")!.x = 1;
    const mv = world.getComponent(drone, "Movement")!;
    mv.path = [{ x: 2, y: 0 }];
    mv.progress = 0.5;
    mv.targetX = 5;
    mv.targetY = 0;
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

    const m = world.getComponent(drone, "Movement")!;
    // Другая цель → новый путь от позиции (1,0) к (1,3).
    expect(m.targetX).toBe(1);
    expect(m.targetY).toBe(3);
    expect(m.path.length).toBeGreaterThan(0);
    expect(m.path[m.path.length - 1]).toEqual({ x: 1, y: 3 });
  });
```

- [ ] **Step 3: Запустить тесты — убедиться, что новые/обновлённые падают**

Run: `npm test -- CodeBehaviorDriver`
Expected: FAIL — driver всё ещё использует `planNextStep`; хвост не пересчитывается, при пустом буфере строится один шаг вместо полного пути.

- [ ] **Step 4: Реализовать ветку буфера в driver**

В `src/game/code/CodeBehaviorDriver.ts`:

Заменить импорт (строка 4):

```typescript
import { extendPathTail, planMoveToPoint } from "../pathfinding/planMove.js";
```

Заменить блок обработки moveTo (от `if (msg.action === "moveTo") {` до `} else if (msg.action === "mine") {`, строки ~193-211):

```typescript
        if (msg.action === "moveTo") {
          if (msg.point !== undefined) {
            const movement = ctx.world.getComponent(droneId, "Movement");
            const sameTarget =
              movement !== undefined &&
              movement.targetX === msg.point.x &&
              movement.targetY === msg.point.y;
            if (movement && sameTarget && movement.path.length > 0) {
              // Та же цель, дрон в движении → пересчитываем хвост от path[0],
              // не трогая path[0]/progress. Воркеру дана фора в шаг, дрон не
              // тормозит. Путь идентичен прежнему. См. спек «РЕВИЗИЯ 2026-06-23».
              extendPathTail(
                droneId,
                msg.point,
                ctx.world,
                ctx.grid,
                ctx.occupied,
              );
            } else {
              // Другая цель или дрон стоит (cold start / буфер пуст) → строим
              // новый путь от позиции дрона. progress сбрасывается —
              // корректно для старта движения и разворота (дрон уже доехал
              // path[0] либо стоит).
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
        } else if (msg.action === "mine") {
```

- [ ] **Step 5: Запустить тесты — убедиться, что проходят**

Run: `npm test -- CodeBehaviorDriver`
Expected: PASS — все тесты, включая обновлённый (пустой буфер → полный путь), пересчёт хвоста (та же цель), смена цели.

- [ ] **Step 6: Весь набор тестов + type-check**

Run: `npm test`
Expected: всё зелёное.

Run: `npm run type-check`
Expected: без ошибок.

Проверить ссылки на `planNextStep` (Grep по `src/`): если остался только в `planMove.ts` (объявление) и `planMove.test.ts` (его тесты) — оставить как есть (функция корректна, тесты зелёные, удалять не требуется).

- [ ] **Step 7: Коммит**

```bash
git add src/game/code/CodeBehaviorDriver.ts src/game/code/CodeBehaviorDriver.test.ts
git commit -m "feat: CodeBehaviorDriver — буфер пути (пересчёт хвоста к той же цели)"
```

---

### Task 4: Верификация в игре (КРИТИЧНО — unit-тестов недостаточно)

**Files:** нет изменений кода. Эта задача — наблюдение в браузере. Прошлые попытки имели зелёные unit-тесты, но ломались в игре — поэтому шаг обязателен и не может быть пропущен.

**Interfaces:** —

- [ ] **Step 1: Запросить у пользователя запуск игры**

Сказать пользователю: «Запусти `npm run dev`, открой игру, вставь дрону код №1 (плавный) и код №2 (с паузами), сообщи наблюдения». Привести оба сниппета. Дождаться ответа — не объявлять задачу выполненной без подтверждения.

Код №1 — должен ехать **плавно без пауз**, подсветка строки `moveTo` НЕ прыгает (висит на moveTo, пересчёт хвоста работает):

```js
while (true) { while (self.inventory === 0) {
  await self.moveTo(World.mines[0].position);
} }
```

Код №2 — должен ехать **с паузами**, подсветка прыгает `moveTo → mine` на каждой клетке:

```js
while (true) { while (self.inventory === 0) {
  await self.moveTo(World.mines[0].position);
  await self.mine();
} }
```

Объяснение для самопроверки: в №1 после каждого шага воркер шлёт `moveTo` к той же цели → `extendPathTail` пересчитывает хвост от `path[0]` (путь идентичен) → буфер не пустеет → нет паузы; подсветка висит на одной строке. В №2 intent чередуется moveTo↔mine → на mine `path` опустошается → пауза каждые 2 шага, подсветка скачет. Оба поведения ожидаемы и доказывают, что пересчёт поведения сохранён.

- [ ] **Step 2: Если в игре пауза в коде №1 — диагностировать, НЕ объявлять успех**

Если пользователь сообщает паузы в №1: применить systematic-debugging. Вероятные точки: ранний resume не доходит (`session.blocked`/`phase`); `targetX/targetY` в снапшоте/movement рассинхронены так, что `sameTarget=false` и каждый раз идёт `planMoveToPoint` (сброс progress → рывок/пауза); `extendPathTail` стартует не от `path[0]`. НЕ переходить к e2e и не коммитить «успех», пока пользователь не подтвердит плавность.

- [ ] **Step 3: После подтверждения пользователем — e2e через skill verify**

Использовать skill `verify`. Готовый handle с этим кодом — `e2e/code-mode.spec.ts`.

Run: `npm run test:e2e -- code-mode`
Expected: PASS.

---

### Task 5: Документация сессии, спека и памяти

**Files:**
- Create: `docs/sessions/2026-06-23-<HHMM>-fix-continuous-movement-path-buffer.md`
- Modify: `docs/superpowers/specs/2026-06-23-continuous-drone-movement-design.md`
- Modify: память `decision_movement_model.md` (через memory-механизм)

- [ ] **Step 1: Записать итоги сессии**

Создать `docs/sessions/2026-06-23-<HHMM>-fix-continuous-movement-path-buffer.md`: цель (continuous через буфер пути), что сделано (`extendPathTail` пересчёт хвоста от `path[0]`, снапшот look-ahead, ветка буфера в driver), результат верификации в игре (плавность №1, паузы №2), статус e2e. Отметить вынесенное в будущее (очередь операций, резервирование клеток).

- [ ] **Step 2: Отметить спек реализованным**

В `docs/superpowers/specs/2026-06-23-continuous-drone-movement-design.md`, раздел «РЕВИЗИЯ 2026-06-23», сменить статус на «✅ реализован (буфер пути: пересчёт хвоста от path[0] + снапшот look-ahead), верифицирован в игре». Уточнить, что хвост считается от path[0] (а не от конца буфера).

- [ ] **Step 3: Обновить память**

Обновить `decision_movement_model.md`: финальная модель реализована и верифицирована; ключевая деталь — `extendPathTail` пересчитывает хвост **от path[0]** (склейка `[path[0], ...newTail]`), снапшот показывает дрона в path[0]. Сменить «СЛЕДУЮЩИЙ ШАГ: writing-plans» на «реализовано, верифицировано».

- [ ] **Step 4: Коммит**

```bash
git add docs/sessions/ docs/superpowers/specs/2026-06-23-continuous-drone-movement-design.md
git commit -m "docs: итоги сессии continuous-движение через буфер пути"
```

---

## Self-Review

**Spec coverage (раздел «РЕВИЗИЯ 2026-06-23» + уточнения пользователя):**
- «path держит весь маршрут» → `planMoveToPoint` пишет весь путь при старте/смене цели (Task 3); `extendPathTail` пересчитывает весь хвост от path[0] (Task 1). ✓
- «MovementSystem уже корректен, не менять» → план его не трогает. ✓
- **Уточнение пользователя:** «пересчёт хвоста ОТ path[0], склейка [path[0], ...newTail]» (не от конца буфера — исправлено) → Task 1, тест "recomputes tail from path[0]... identical for same target". ✓
- «path[0] не трогаем, progress не сбрасываем» → Task 1 тест "does NOT touch path[0]". ✓
- **Уточнение:** снапшот «на шаг вперёд» (self.position = path[0]) → Task 2. ✓
- «другая цель → новый путь от позиции» → `planMoveToPoint` (Task 3, тест "DIFFERENT target"). ✓
- «ранний resume на drone:moved остаётся» → `onDroneMoved` не трогаем (Task 3 меняет только ветку intent). ✓
- **Уточнение:** код №1 плавный (moveTo подряд к одной цели), код №2 с паузами (moveTo↔mine) — оба ожидаемы → Task 4. ✓
- «не-move с непустым path / очередь операций» и «резервирование клеток» → явно вынесено в «Вне scope». ✓
- «верификация в игре критична» → Task 4, человеческий шаг, нельзя пропустить. ✓

**Placeholder scan:** код приведён полностью во всех code-шагах; команды и Expected указаны. `<HHMM>` в Task 5 — намеренная часть имени файла по конвенции CLAUDE.md (дата+время+slug).

**Type consistency:** `extendPathTail(droneId, target, world, grid, occupied)` — сигнатура идентична в Task 1 (объявление) и Task 3 (вызов). `planMoveToPoint` — существующая сигнатура. `droneSnap` → `DroneSnap.position` (`{x,y}`) не меняет тип, только источник значения. Сравнение цели по `targetX/targetY` (поля `MovementComponent`) согласовано во всех задачах.

## Execution Handoff

После сохранения плана — предложить выбор способа исполнения.
