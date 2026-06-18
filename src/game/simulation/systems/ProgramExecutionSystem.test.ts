import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../world/World.js";
import { Grid } from "../world/Grid.js";
import { CollisionSystem } from "./CollisionSystem.js";
import { ProgramExecutionSystem } from "./ProgramExecutionSystem.js";
import { CodeBehaviorDriver } from "../../code/CodeBehaviorDriver.js";
import { NodeWorkerPort } from "../../code/worker/NodeWorkerPort.js";
import type { ProgramRegistry } from "../../programs/types.js";

const GRID = new Grid();

function makeRegistry(code = ""): ProgramRegistry {
  return new Map([
    [
      "prog",
      {
        id: "prog",
        name: "Prog",
        behavior: { sourceForm: "code" as const, code },
      },
    ],
  ]);
}

function makeCodeDriver() {
  return new CodeBehaviorDriver({
    createPort: () => new NodeWorkerPort(),
    timeoutMs: 1000,
  });
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

describe("ProgramExecutionSystem — update gating", () => {
  let world: World;
  let collision: CollisionSystem;
  let system: ProgramExecutionSystem;

  beforeEach(() => {
    world = new World();
    collision = new CollisionSystem(world);
  });

  function makeSystem(code = "await drone.mine();") {
    system = new ProgramExecutionSystem(
      world,
      GRID,
      collision,
      makeRegistry(code),
      makeCodeDriver(),
    );
    return system;
  }

  it("skips drone already in an action state", () => {
    makeSystem();
    const id = addDrone(world, "mine");
    collision.update();
    system.update();
    expect(world.getComponent(id, "Program")!.state).toBe("mine");
    system.dispose();
  });

  it("skips idle drone", () => {
    makeSystem();
    const id = addDrone(world, "idle");
    collision.update();
    system.update();
    expect(world.getComponent(id, "Program")!.state).toBe("idle");
    system.dispose();
  });

  it("skips locally paused drone", () => {
    makeSystem();
    const id = addDrone(world, "running");
    world.getComponent(id, "Program")!.localPaused = true;
    collision.update();
    system.update();
    expect(world.getComponent(id, "Program")!.state).toBe("running");
    system.dispose();
  });
});

describe("ProgramExecutionSystem — code execution", () => {
  it("executes a code program via CodeBehaviorDriver", async () => {
    const world = new World();
    const collision = new CollisionSystem(world);
    const codeDriver = makeCodeDriver();
    const system = new ProgramExecutionSystem(
      world,
      GRID,
      collision,
      makeRegistry("await drone.mine();"),
      codeDriver,
    );

    const id = addDrone(world, "running");

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
