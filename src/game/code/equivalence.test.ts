import { describe, it, expect } from "vitest";
import { World } from "../simulation/world/World.js";
import { Grid } from "../simulation/world/Grid.js";
import { AstBehaviorDriver } from "./AstBehaviorDriver.js";
import { CodeBehaviorDriver } from "./CodeBehaviorDriver.js";
import { NodeWorkerPort } from "./worker/NodeWorkerPort.js";
import type { ProgramRegistry, Instruction } from "../programs/types.js";

const GRID = new Grid();
const OCCUPIED = new Set<string>();

function setupWorld(): { world: World; drone: number; ore: number } {
  const world = new World();

  const ore = world.createEntity();
  world.addComponent(ore, "Position", { x: 2, y: 0 });
  world.addComponent(ore, "Deposit", { oreRemaining: 5, mineRate: 1 });

  const drone = world.createEntity();
  world.addComponent(drone, "Position", { x: 0, y: 0 });
  world.addComponent(drone, "Energy", {
    current: 100,
    max: 100,
    drainPerMove: 5,
    drainPerMine: 2,
  });
  world.addComponent(drone, "Inventory", { ore: 0, capacity: 10 });
  world.addComponent(drone, "Movement", {
    targetX: 0,
    targetY: 0,
    path: [],
    progress: 0,
    speed: 1,
  });

  return { world, drone, ore };
}

function applySystems(world: World, droneId: number): void {
  // Минимальная имитация MovementSystem: один шаг пути за тик переводит
  // state 'move' -> 'running', когда путь пройден.
  const movement = world.getComponent(droneId, "Movement")!;
  const program = world.getComponent(droneId, "Program")!;
  if (program.state === "move") {
    if (movement.path.length > 0) {
      const next = movement.path.shift()!;
      const pos = world.getComponent(droneId, "Position")!;
      pos.x = next.x;
      pos.y = next.y;
    }
    if (movement.path.length === 0) {
      program.state = "running";
    }
  } else if (
    program.state === "mine" ||
    program.state === "drop" ||
    program.state === "charge"
  ) {
    program.state = "running";
  }
}

describe("block vs code equivalence", () => {
  it("produces an identical state trace for moveTo+mine", async () => {
    // --- AST ---
    const { world: w1, drone: d1, ore: o1 } = setupWorld();
    const instructions: Instruction[] = [
      { type: "MOVE_TO", targetEntityId: o1 },
      { type: "MINE" },
    ];
    const registry: ProgramRegistry = new Map([
      ["prog", { id: "prog", name: "Prog", instructions, behaviorMode: "block" }],
    ]);
    w1.addComponent(d1, "Program", {
      currentProgramId: "prog",
      callStack: [{ programId: "prog", instructionIndex: 0 }],
      state: "running",
      commandSlots: 4,
      personalProgramId: "",
    });
    const astDriver = new AstBehaviorDriver();
    const traceAst: string[] = [];
    for (let i = 0; i < 20; i++) {
      const program = w1.getComponent(d1, "Program")!;
      if (program.state !== "running") {
        traceAst.push(program.state);
        applySystems(w1, d1);
        if (program.state === "idle") break;
        continue;
      }
      astDriver.step(d1, { world: w1, grid: GRID, registry, occupied: OCCUPIED });
      traceAst.push(w1.getComponent(d1, "Program")!.state);
      if (w1.getComponent(d1, "Program")!.state === "idle") break;
    }

    // --- CODE ---
    const { world: w2, drone: d2, ore: o2 } = setupWorld();
    w2.addComponent(d2, "Program", {
      currentProgramId: null,
      callStack: [],
      state: "running",
      commandSlots: 4,
      personalProgramId: "",
      codeSource: "await drone.moveTo(ore); await drone.mine();",
    });
    const codeDriver = new CodeBehaviorDriver({
      createPort: () => new NodeWorkerPort(),
      timeoutMs: 1000,
      entities: () => ({ ore: o2 }),
    });
    const traceCode: string[] = [];
    try {
      for (let i = 0; i < 200; i++) {
        const program = w2.getComponent(d2, "Program")!;
        traceCode.push(program.state);
        if (program.state === "idle" && traceCode.length > 1) break;
        if (program.state !== "running") {
          applySystems(w2, d2);
          codeDriver.step(d2, {
            world: w2,
            grid: GRID,
            registry: new Map(),
            occupied: OCCUPIED,
          });
          continue;
        }
        codeDriver.step(d2, {
          world: w2,
          grid: GRID,
          registry: new Map(),
          occupied: OCCUPIED,
        });
        await new Promise((r) => setTimeout(r, 5));
      }
    } finally {
      codeDriver.disposeAll();
    }

    // Сравниваем только последовательность *смен* action-состояний (move/mine/idle),
    // игнорируя 'running' и количество повторов одного и того же состояния подряд —
    // синхронизация воркера может занимать разное число тиков ожидания, но
    // порядок переходов между состояниями должен совпасть.
    const actionTransitions = (trace: string[]): string[] => {
      const actions = trace.filter((s) => s === "move" || s === "mine" || s === "idle");
      return actions.filter((s, i) => i === 0 || s !== actions[i - 1]);
    };

    expect(actionTransitions(traceCode)).toEqual(actionTransitions(traceAst));
  }, 10000);
});
