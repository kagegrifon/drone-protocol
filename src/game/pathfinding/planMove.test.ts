import { describe, it, expect } from "vitest";
import { World } from "../simulation/world/World.js";
import { Grid } from "../simulation/world/Grid.js";
import { planMoveToPoint, planNextStep, extendPathTail } from "./planMove.js";

function makeDrone(world: World, x: number, y: number) {
  const drone = world.createEntity();
  world.addComponent(drone, "Position", { x, y });
  world.addComponent(drone, "Movement", {
    path: [],
    targetX: x,
    targetY: y,
    progress: 0,
    speed: 1,
  });
  return drone;
}

describe("planMoveToPoint", () => {
  it("writes A* path and target into Movement", () => {
    const world = new World();
    const grid = new Grid();
    const drone = makeDrone(world, 0, 0);

    planMoveToPoint(drone, { x: 2, y: 0 }, world, grid, new Set());

    const movement = world.getComponent(drone, "Movement")!;
    expect(movement.path).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(movement.targetX).toBe(2);
    expect(movement.targetY).toBe(0);
    expect(movement.progress).toBe(0);
  });

  it("does nothing when drone has no Position", () => {
    const world = new World();
    const grid = new Grid();
    const ghost = world.createEntity();

    expect(() =>
      planMoveToPoint(ghost, { x: 1, y: 1 }, world, grid, new Set()),
    ).not.toThrow();
  });

  it("does not overwrite Movement when no path exists", () => {
    const world = new World();
    const grid = new Grid();
    const drone = makeDrone(world, 0, 0);
    // Полностью блокируем цель
    grid.setTile(1, 0, "wall");
    grid.setTile(0, 1, "wall");
    grid.setTile(2, 1, "wall");
    grid.setTile(1, 2, "wall");
    grid.setTile(1, 1, "wall");

    planMoveToPoint(drone, { x: 1, y: 1 }, world, grid, new Set());

    const movement = world.getComponent(drone, "Movement")!;
    expect(movement.path).toEqual([]);
  });
});

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
