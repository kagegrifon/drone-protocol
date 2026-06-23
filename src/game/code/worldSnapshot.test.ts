import { describe, it, expect } from "vitest";
import { World } from "../simulation/world/World.js";
import { collectWorld } from "./worldSnapshot.js";

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
  world.addComponent(drone, "Energy", {
    current: 80,
    max: 100,
    drainPerMove: 5,
    drainPerMine: 2,
  });
  world.addComponent(drone, "Inventory", { ore: 3, capacity: 10 });
  return drone;
}

describe("collectWorld", () => {
  it("collects self with full drone detail", () => {
    const world = new World();
    const drone = makeDrone(world, 1, 2);

    const snap = collectWorld(world, drone, new Map());

    expect(snap.self.id).toBe(drone);
    expect(snap.self.type).toBe("drone");
    expect(snap.self.position).toEqual({ x: 1, y: 2 });
    expect(snap.self.energy).toBe(80);
    expect(snap.self.energyMax).toBe(100);
    expect(snap.self.inventory).toBe(3);
    expect(snap.self.inventoryMax).toBe(10);
  });

  it("collects mines with oreRemaining and freeSlots by type map", () => {
    const world = new World();
    const drone = makeDrone(world, 0, 0);

    const mine = world.createEntity();
    world.addComponent(mine, "Position", { x: 3, y: 0 });
    world.addComponent(mine, "Deposit", { oreRemaining: 5, mineRate: 1 });
    world.addComponent(mine, "WorkSlots", {
      slots: [
        { x: 3, y: 1, occupiedBy: null },
        { x: 3, y: 2, occupiedBy: 99 },
      ],
    });

    const snap = collectWorld(world, drone, new Map([[mine, "mine"]]));

    expect(snap.mines).toHaveLength(1);
    expect(snap.mines[0]).toMatchObject({
      id: mine,
      type: "mine",
      position: { x: 3, y: 0 },
      oreRemaining: 5,
      freeSlots: 1,
    });
  });

  it("collects bases with storedOre and freeSlots", () => {
    const world = new World();
    const drone = makeDrone(world, 0, 0);

    const base = world.createEntity();
    world.addComponent(base, "Position", { x: 5, y: 5 });
    world.addComponent(base, "Inventory", { ore: 12, capacity: 1000 });
    world.addComponent(base, "WorkSlots", {
      slots: [{ x: 5, y: 6, occupiedBy: null }],
    });

    const snap = collectWorld(world, drone, new Map([[base, "base"]]));

    expect(snap.bases).toHaveLength(1);
    expect(snap.bases[0]).toMatchObject({
      id: base,
      type: "base",
      position: { x: 5, y: 5 },
      storedOre: 12,
      freeSlots: 1,
    });
  });

  it("collects chargers with freeSlots", () => {
    const world = new World();
    const drone = makeDrone(world, 0, 0);

    const charger = world.createEntity();
    world.addComponent(charger, "Position", { x: 2, y: 2 });
    world.addComponent(charger, "WorkSlots", {
      slots: [
        { x: 2, y: 3, occupiedBy: null },
        { x: 2, y: 4, occupiedBy: null },
      ],
    });

    const snap = collectWorld(world, drone, new Map([[charger, "charger"]]));

    expect(snap.chargers).toHaveLength(1);
    expect(snap.chargers[0]).toMatchObject({
      id: charger,
      type: "charger",
      position: { x: 2, y: 2 },
      freeSlots: 2,
    });
  });

  it("includes all drones (incl. self) in drones[]", () => {
    const world = new World();
    const self = makeDrone(world, 0, 0);
    const other = makeDrone(world, 4, 4);

    const snap = collectWorld(world, self, new Map());

    const ids = snap.drones.map((d) => d.id).sort((a, b) => a - b);
    expect(ids).toEqual([self, other].sort((a, b) => a - b));
    expect(snap.drones.every((d) => d.type === "drone")).toBe(true);
  });

  it("skips entities without Position (destroyed)", () => {
    const world = new World();
    const drone = makeDrone(world, 0, 0);
    const mine = world.createEntity();
    // Намеренно без Position — сущность «уничтожена».
    world.addComponent(mine, "Deposit", { oreRemaining: 5, mineRate: 1 });

    const snap = collectWorld(world, drone, new Map([[mine, "mine"]]));

    expect(snap.mines).toHaveLength(0);
  });

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
});
