import { describe, it, expect } from "vitest";
import { World } from "../simulation/world/World.js";
import { Grid } from "../simulation/world/Grid.js";
import { planMoveToPoint, planNextStep } from "./planMove.js";

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
