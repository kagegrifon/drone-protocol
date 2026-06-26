import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../world/World.js";
import { MovementSystem } from "./MovementSystem.js";
import { gameEvents } from "../../../shared/events/gameEvents.js";

function makeWorld() {
  return new World();
}

function addDrone(
  world: World,
  x: number,
  y: number,
  pathTo: { x: number; y: number }[],
  speed = 1,
  energy = 100,
  state: "idle" | "running" | "move" | "mine" | "drop" | "charge" = "move",
) {
  const id = world.createEntity();
  world.addComponent(id, "Position", { x, y });
  world.addComponent(id, "Energy", {
    current: energy,
    max: 100,
    drainPerMove: 5,
    drainPerMine: 2,
  });
  const last = pathTo[pathTo.length - 1];
  world.addComponent(id, "Movement", {
    targetX: last?.x ?? x,
    targetY: last?.y ?? y,
    path: [...pathTo],
    progress: 0,
    speed,
  });
  world.addComponent(id, "Program", {
    currentProgramId: null,
    callStack: [],
    state,
    commandSlots: 4,
    personalProgramId: "",
  });
  return id;
}

describe("MovementSystem", () => {
  let world: World;
  let system: MovementSystem;

  beforeEach(() => {
    world = makeWorld();
    system = new MovementSystem(world);
  });

  // speed=1 (клеток/сек): progress += DT*1 = 0.1 за тик → 10 тиков = 1 шаг
  it("accumulates progress but does not move in 1 tick at speed=1", () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 1);
    system.update();
    const pos = world.getComponent(id, "Position")!;
    expect(pos.x).toBe(0); // не сдвинулся
    const movement = world.getComponent(id, "Movement")!;
    expect(movement.progress).toBeCloseTo(0.1);
  });

  it("moves drone one cell per 10 ticks at speed=1, continuing along the path", () => {
    const id = addDrone(
      world,
      0,
      0,
      [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      1,
    );
    for (let i = 0; i < 10; i++) system.update();
    const pos = world.getComponent(id, "Position")!;
    expect(pos.x).toBe(1);
    expect(pos.y).toBe(0);
    // Continuous-движение: путь больше не зачищается после шага —
    // дрон продолжает движение к следующей клетке.
    for (let i = 0; i < 10; i++) system.update();
    const pos2 = world.getComponent(id, "Position")!;
    expect(pos2.x).toBe(2);
  });

  // speed=10 (клеток/сек): progress += DT*10 = 1.0 за тик → 1 тик = 1 шаг
  it("moves drone one cell per tick at speed=10", () => {
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
    const pos = world.getComponent(id, "Position")!;
    expect(pos.x).toBe(1);
    expect(pos.y).toBe(0);
  });

  it("drains energy per step entered", () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10);
    system.update();
    const energy = world.getComponent(id, "Energy")!;
    expect(energy.current).toBe(95); // 100 - 5
  });

  // speed=20: progress += 2.0 за тик → новая семантика: всё равно 1 шаг за команду
  it("advances exactly one cell per command even when speed=20", () => {
    const id = addDrone(
      world,
      0,
      0,
      [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      20,
    );
    system.update();
    const pos = world.getComponent(id, "Position")!;
    expect(pos.x).toBe(1);
    expect(pos.y).toBe(0);
  });

  it("drains energy only once per atomic step even at speed=20", () => {
    const id = addDrone(
      world,
      0,
      0,
      [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      20,
    );
    system.update();
    const energy = world.getComponent(id, "Energy")!;
    expect(energy.current).toBe(95); // 100 - 5*1 (атомарный шаг)
  });

  it("resumes program on arrival (state=move)", () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10);
    system.update();
    const program = world.getComponent(id, "Program")!;
    expect(program.state).toBe("running");
  });

  it("does not resume program if state is not move", () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10, 100, "mine");
    system.update();
    const program = world.getComponent(id, "Program")!;
    expect(program.state).toBe("mine");
  });

  it("does not move drone with empty path", () => {
    const id = addDrone(world, 3, 3, []);
    system.update();
    const pos = world.getComponent(id, "Position")!;
    expect(pos.x).toBe(3);
    expect(pos.y).toBe(3);
  });

  it("clamps energy to 0 when drain exceeds current energy", () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10, 3); // energy=3, drainPerMove=5
    system.update();
    const energy = world.getComponent(id, "Energy")!;
    expect(energy.current).toBe(0);
  });

  it("resets progress to 0 after arrival", () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10);
    system.update();
    const movement = world.getComponent(id, "Movement")!;
    expect(movement.progress).toBe(0);
    expect(movement.path.length).toBe(0);
  });

  it("keeps the remaining path after one step (continuous movement)", () => {
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
    const movement = world.getComponent(id, "Movement")!;
    // Пройденная клетка снимается через shift(), хвост сохраняется —
    // дрон продолжит движение по нему на следующих тиках.
    expect(movement.path).toEqual([
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
    expect(movement.progress).toBe(0);
  });
});

describe("MovementSystem — drone:moved эмиссия", () => {
  let world: World;
  let system: MovementSystem;

  beforeEach(() => {
    world = makeWorld();
    system = new MovementSystem(world);
    gameEvents.clearAll();
  });

  it("эмитит drone:moved с корректными координатами при успешном шаге", () => {
    const events: Array<{
      droneId: number;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
    }> = [];
    gameEvents.on("drone:moved", (e) => events.push(e));

    const d = addDrone(world, 3, 5, [{ x: 4, y: 5 }], 10);
    system.update();

    expect(events).toEqual([
      { droneId: d, fromX: 3, fromY: 5, toX: 4, toY: 5 },
    ]);
  });

  it("не эмитит drone:moved если путь пуст", () => {
    const events: unknown[] = [];
    gameEvents.on("drone:moved", (e) => events.push(e));

    addDrone(world, 0, 0, []);
    system.update();

    expect(events).toHaveLength(0);
  });
});

describe("MovementSystem — разрешение коллизий (двухфазное)", () => {
  let world: World;
  let system: MovementSystem;

  beforeEach(() => {
    world = makeWorld();
    system = new MovementSystem(world);
    gameEvents.clearAll();
  });

  it("два дрона в одну пустую клетку: младший id едет, старший ждёт", () => {
    const d1 = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10); // меньший id → победит
    const d2 = addDrone(world, 2, 0, [{ x: 1, y: 0 }], 10); // больший id → ждёт

    system.update();

    expect(world.getComponent(d1, "Position")).toMatchObject({ x: 1, y: 0 });
    expect(world.getComponent(d2, "Position")).toMatchObject({ x: 2, y: 0 });
  });

  it("ждущий дрон сохраняет путь и сбрасывает progress (не отбрасывается)", () => {
    addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10);
    const d2 = addDrone(world, 2, 0, [{ x: 1, y: 0 }], 10);

    system.update();

    const mov2 = world.getComponent(d2, "Movement")!;
    // Путь НЕ зачищается — дрон ждёт, не теряя цель.
    expect(mov2.path).toEqual([{ x: 1, y: 0 }]);
    expect(mov2.progress).toBe(0);
  });

  it("движущийся дрон не въезжает в клетку стоящего дрона", () => {
    // d1 стоит в (1,0) без пути; d2 хочет туда же.
    addDrone(world, 1, 0, [], 10);
    const d2 = addDrone(world, 2, 0, [{ x: 1, y: 0 }], 10);

    system.update();

    expect(world.getComponent(d2, "Position")).toMatchObject({ x: 2, y: 0 });
  });

  it("цепочка A→B→C: колонна трогается по очереди (за тик едет только головной)", () => {
    // C в (2,0) едет в (3,0); B в (1,0) едет в (2,0); A в (0,0) едет в (1,0).
    // Клетка освобождается только по факту прибытия → за тик двигается лишь C.
    const a = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10);
    const b = addDrone(world, 1, 0, [{ x: 2, y: 0 }], 10);
    const c = addDrone(world, 2, 0, [{ x: 3, y: 0 }], 10);

    system.update();
    expect(world.getComponent(c, "Position")).toMatchObject({ x: 3, y: 0 });
    // B и A ждут: их цель ещё занята соседом на начало тика.
    expect(world.getComponent(b, "Position")).toMatchObject({ x: 1, y: 0 });
    expect(world.getComponent(a, "Position")).toMatchObject({ x: 0, y: 0 });

    // Следующий тик: (2,0) освободилась → B едет; A ждёт, пока освободится (1,0).
    system.update();
    expect(world.getComponent(b, "Position")).toMatchObject({ x: 2, y: 0 });
    expect(world.getComponent(a, "Position")).toMatchObject({ x: 0, y: 0 });

    // Третий тик: (1,0) освободилась → A едет.
    system.update();
    expect(world.getComponent(a, "Position")).toMatchObject({ x: 1, y: 0 });
  });

  it("встречный обмен (swap) запрещён: проходит только один дрон", () => {
    // A в (0,0) едет в (1,0); B в (1,0) едет в (0,0) — навстречу.
    const a = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10);
    const b = addDrone(world, 1, 0, [{ x: 0, y: 0 }], 10);

    system.update();

    const posA = world.getComponent(a, "Position")!;
    const posB = world.getComponent(b, "Position")!;
    // Дроны не должны пройти сквозь друг друга (оказаться оба в новых клетках).
    const swapped = posA.x === 1 && posB.x === 0;
    expect(swapped).toBe(false);
  });

  it("два дрона в разные клетки — оба проходят", () => {
    const d1 = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10);
    const d2 = addDrone(world, 0, 1, [{ x: 1, y: 1 }], 10);

    system.update();

    expect(world.getComponent(d1, "Position")).toMatchObject({ x: 1, y: 0 });
    expect(world.getComponent(d2, "Position")).toMatchObject({ x: 1, y: 1 });
  });

  it("ждущий дрон проходит, когда клетка фактически освободилась", () => {
    // d1 стоит в (1,0); d2 хочет туда. Пока d1 там — d2 ждёт.
    const d1 = addDrone(world, 1, 0, [], 10);
    const d2 = addDrone(world, 2, 0, [{ x: 1, y: 0 }], 10);

    system.update();
    expect(world.getComponent(d2, "Position")).toMatchObject({ x: 2, y: 0 });

    // d1 уезжает прочь. В этом тике d1 ещё числится в (1,0) на начало тика,
    // поэтому d2 продолжает ждать.
    world.getComponent(d1, "Movement")!.path = [{ x: 1, y: 5 }];
    system.update();
    expect(world.getComponent(d1, "Position")).toMatchObject({ x: 1, y: 5 });
    expect(world.getComponent(d2, "Position")).toMatchObject({ x: 2, y: 0 });

    // Теперь (1,0) свободна на начало тика → d2 проходит.
    system.update();
    expect(world.getComponent(d2, "Position")).toMatchObject({ x: 1, y: 0 });
  });

  it("дрон шагает в свою же клетку (path[0] === position) — шаг разрешён", () => {
    const d = addDrone(world, 1, 0, [{ x: 1, y: 0 }], 10); // цель = текущая позиция
    system.update();
    const mov = world.getComponent(d, "Movement")!;
    expect(mov.path).toEqual([]);
  });

  // Главный сценарий бага: при медленной скорости два дрона едут в одну клетку.
  // Один резервирует её при выезде (progress=0), второй НЕ должен начинать
  // движение вообще — иначе он накопит progress, «почти доедет» и его
  // отбросит назад, когда первый займёт клетку.
  it("ждущий дрон НЕ копит progress, пока цель зарезервирована (нет отбрасывания)", () => {
    addDrone(world, 0, 0, [{ x: 1, y: 0 }], 1); // d1: резервирует (1,0) при выезде
    const d2 = addDrone(world, 2, 0, [{ x: 1, y: 0 }], 1); // d2: та же цель

    // Несколько тиков, пока d1 ещё в пути (progress < 1): d2 не должен сдвигать
    // свою визуальную позицию — его progress остаётся 0.
    for (let i = 0; i < 5; i++) {
      system.update();
      const mov2 = world.getComponent(d2, "Movement")!;
      expect(mov2.progress).toBe(0);
    }
    // d1 ещё едет, d2 всё ещё на месте.
    expect(world.getComponent(d2, "Position")).toMatchObject({ x: 2, y: 0 });
  });

  it("дрон резервирует целевую клетку на всё время движения (progress 0→1)", () => {
    const d1 = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 1);
    system.update(); // d1 выехал: progress > 0, цель (1,0) зарезервирована
    const mov1 = world.getComponent(d1, "Movement")!;
    expect(mov1.progress).toBeGreaterThan(0);
    expect(mov1.reserved).toEqual({ x: 1, y: 0 });
  });
});
