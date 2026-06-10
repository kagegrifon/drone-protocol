import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../world/World.js";
import { Grid } from "../world/Grid.js";
import { CollisionSystem } from "./CollisionSystem.js";
import { ProgramExecutionSystem } from "./ProgramExecutionSystem.js";
import type { ProgramRegistry } from "../../programs/types.js";

const GRID = new Grid();

function makeRegistry(instructions: object[] = []): ProgramRegistry {
  return new Map([
    ["prog", { id: "prog", name: "Prog", instructions: instructions as never }],
  ]);
}

function addDrone(
  world: World,
  state: "idle" | "running" | "move" | "mine" | "drop" | "charge" = "running",
) {
  const id = world.createEntity();
  world.addComponent(id, "Position", { x: 0, y: 0 });
  world.addComponent(id, "Energy", {
    current: 100,
    max: 100,
    drainPerMove: 5,
    drainPerMine: 2,
  });
  world.addComponent(id, "Inventory", { ore: 0, capacity: 10 });
  world.addComponent(id, "Movement", {
    targetX: 0,
    targetY: 0,
    path: [],
    progress: 0,
    speed: 1,
  });
  world.addComponent(id, "Program", {
    currentProgramId: "prog",
    callStack:
      state === "running" ? [{ programId: "prog", instructionIndex: 0 }] : [],
    state,
    commandSlots: 4,
    personalProgramId: "",
  });
  return id;
}

describe("ProgramExecutionSystem", () => {
  let world: World;
  let collision: CollisionSystem;
  let system: ProgramExecutionSystem;

  beforeEach(() => {
    world = makeWorld();
    collision = new CollisionSystem(world);
  });

  function makeWorld() {
    return new World();
  }

  function makeSystem(registry: ProgramRegistry) {
    return new ProgramExecutionSystem(world, GRID, collision, registry);
  }

  it("executes MINE instruction for running drone on update", () => {
    const registry = makeRegistry([{ type: "MINE" }]);
    system = makeSystem(registry);
    const id = addDrone(world, "running");
    collision.update();
    system.update();
    const prog = world.getComponent(id, "Program")!;
    expect(prog.state).toBe("mine");
  });

  it("skips drone already in an action state", () => {
    const registry = makeRegistry([{ type: "MINE" }]);
    system = makeSystem(registry);
    const id = addDrone(world, "mine");
    collision.update();
    system.update();
    expect(world.getComponent(id, "Program")!.state).toBe("mine");
  });

  it("skips idle drone", () => {
    const registry = makeRegistry([]);
    system = makeSystem(registry);
    const id = addDrone(world, "idle");
    collision.update();
    system.update();
    expect(world.getComponent(id, "Program")!.state).toBe("idle");
  });

  it("processes multiple drones independently", () => {
    const registry = makeRegistry([{ type: "DROP" }]);
    system = makeSystem(registry);
    const id1 = addDrone(world, "running");
    const id2 = addDrone(world, "running");
    collision.update();
    system.update();
    expect(world.getComponent(id1, "Program")!.state).toBe("drop");
    expect(world.getComponent(id2, "Program")!.state).toBe("drop");
  });

  it("drone with empty program becomes idle after update", () => {
    const registry = makeRegistry([]);
    system = makeSystem(registry);
    const id = addDrone(world, "running");
    collision.update();
    system.update();
    expect(world.getComponent(id, "Program")!.state).toBe("idle");
  });

  it("uses collision occupied set for MOVE_TO pathfinding", () => {
    const targetId = world.createEntity();
    world.addComponent(targetId, "Position", { x: 2, y: 0 });

    const registry = new Map([
      [
        "prog",
        {
          id: "prog",
          name: "Prog",
          instructions: [
            { type: "MOVE_TO", targetEntityId: targetId },
          ] as never,
        },
      ],
    ]);
    system = new ProgramExecutionSystem(world, GRID, collision, registry);

    const id = addDrone(world, "running");
    collision.update();
    system.update();

    const movement = world.getComponent(id, "Movement")!;
    expect(movement.targetX).toBe(2);
    expect(movement.targetY).toBe(0);
  });

  it("uses CodeBehaviorDriver when program.codeSource is set", async () => {
    const { CodeBehaviorDriver } = await import("../../code/CodeBehaviorDriver.js");
    const { NodeWorkerPort } = await import("../../code/worker/NodeWorkerPort.js");

    const registry = makeRegistry([]);
    const codeDriver = new CodeBehaviorDriver({
      createPort: () => new NodeWorkerPort(),
      timeoutMs: 1000,
    });
    system = new ProgramExecutionSystem(world, GRID, collision, registry, codeDriver);

    const id = addDrone(world, "running");
    world.getComponent(id, "Program")!.codeSource = "await drone.mine();";

    collision.update();
    for (let i = 0; i < 50; i++) {
      system.update();
      if (world.getComponent(id, "Program")!.state === "mine") break;
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(world.getComponent(id, "Program")!.state).toBe("mine");
    codeDriver.disposeAll();
  }, 5000);
});
