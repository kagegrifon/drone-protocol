import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../game/simulation/world/World.js";
import { Grid } from "../game/simulation/world/Grid.js";
import type { ProgramRegistry } from "../game/programs/types.js";
import { AstBehaviorDriver } from "./AstBehaviorDriver.js";
import { Instruction } from "./types.js";

const EMPTY_GRID = new Grid();
const EMPTY_OCCUPIED = new Set<string>();

function addDrone(world: World, instructions: Instruction[]) {
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
  const programId = "prog_main";
  const registry: ProgramRegistry = new Map([
    [
      programId,
      {
        id: programId,
        name: "Main",
        behavior: { sourceForm: "block", instructions },
      },
    ],
  ]);
  world.addComponent(id, "Program", {
    currentProgramId: programId,
    callStack: [{ programId, instructionIndex: 0 }],
    state: "running",
    commandSlots: 4,
    personalProgramId: "",
  });
  return { id, registry };
}

describe("AstBehaviorDriver", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("delegates to stepProgram and sets state=mine", () => {
    const { id, registry } = addDrone(world, [{ type: "MINE" }]);
    const driver = new AstBehaviorDriver();
    driver.step(id, {
      world,
      grid: EMPTY_GRID,
      registry,
      occupied: EMPTY_OCCUPIED,
    });
    const prog = world.getComponent(id, "Program")!;
    expect(prog.state).toBe("mine");
  });

  it("empty program becomes idle", () => {
    const { id, registry } = addDrone(world, []);
    const driver = new AstBehaviorDriver();
    driver.step(id, {
      world,
      grid: EMPTY_GRID,
      registry,
      occupied: EMPTY_OCCUPIED,
    });
    const prog = world.getComponent(id, "Program")!;
    expect(prog.state).toBe("idle");
  });
});
