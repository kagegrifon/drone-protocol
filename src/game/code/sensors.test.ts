import { describe, it, expect } from "vitest";
import { World } from "../simulation/world/World.js";
import { collectSensors } from "./sensors.js";

describe("collectSensors", () => {
  it("collects energy/inventory/freeSlots and positions/deposits for entities", () => {
    const world = new World();

    const drone = world.createEntity();
    world.addComponent(drone, "Position", { x: 0, y: 0 });
    world.addComponent(drone, "Energy", {
      current: 80,
      max: 100,
      drainPerMove: 5,
      drainPerMine: 2,
    });
    world.addComponent(drone, "Inventory", { ore: 3, capacity: 10 });
    world.addComponent(drone, "WorkSlots", {
      slots: [
        { x: 0, y: 0, occupiedBy: null },
        { x: 0, y: 1, occupiedBy: null },
      ],
    });

    const ore = world.createEntity();
    world.addComponent(ore, "Position", { x: 3, y: 0 });
    world.addComponent(ore, "Deposit", { oreRemaining: 5, mineRate: 1 });

    const snapshot = collectSensors(world, drone, { ore });

    expect(snapshot.energy).toBe(80);
    expect(snapshot.energyMax).toBe(100);
    expect(snapshot.inventory).toBe(3);
    expect(snapshot.inventoryMax).toBe(10);
    expect(snapshot.freeSlots).toBe(2);
    expect(snapshot.positions[drone]).toEqual({ x: 0, y: 0 });
    expect(snapshot.positions[ore]).toEqual({ x: 3, y: 0 });
    expect(snapshot.deposits[ore]).toBe(5);
  });

  it("freeSlots is 0 when the drone has no WorkSlots component", () => {
    const world = new World();
    const drone = world.createEntity();
    world.addComponent(drone, "Position", { x: 0, y: 0 });
    world.addComponent(drone, "Energy", {
      current: 100,
      max: 100,
      drainPerMove: 5,
      drainPerMine: 2,
    });
    world.addComponent(drone, "Inventory", { ore: 0, capacity: 10 });

    const snapshot = collectSensors(world, drone, {});
    expect(snapshot.freeSlots).toBe(0);
  });
});
