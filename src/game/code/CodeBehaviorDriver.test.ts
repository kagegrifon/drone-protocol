import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { World } from "../simulation/world/World.js";
import { Grid } from "../simulation/world/Grid.js";
import { CodeBehaviorDriver } from "./CodeBehaviorDriver.js";
import { NodeWorkerPort } from "./worker/NodeWorkerPort.js";
import type { ProgramRegistry } from "../programs/types.js";

const EMPTY_GRID = new Grid();
const EMPTY_OCCUPIED = new Set<string>();

function addDrone(world: World, codeSource: string, x = 0, y = 0) {
  const id = world.createEntity();
  world.addComponent(id, "Position", { x, y });
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
    currentProgramId: "personal",
    callStack: [],
    state: "running",
    commandSlots: 4,
    personalProgramId: "personal",
  });
  const registry: ProgramRegistry = new Map([
    [
      "personal",
      {
        id: "personal",
        name: "Personal",
        behavior: { sourceForm: "code", code: codeSource },
      },
    ],
  ]);
  return { id, registry };
}

function ctx(world: World, registry: ProgramRegistry) {
  return { world, grid: EMPTY_GRID, registry, occupied: EMPTY_OCCUPIED };
}

async function tickUntil(
  driver: CodeBehaviorDriver,
  droneId: number,
  world: World,
  registry: ProgramRegistry,
  predicate: () => boolean,
  maxTicks = 200,
) {
  for (let i = 0; i < maxTicks; i++) {
    driver.step(droneId, ctx(world, registry));
    if (predicate()) return i;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("tickUntil: predicate not satisfied within maxTicks");
}

describe("CodeBehaviorDriver", () => {
  let world: World;
  let driver: CodeBehaviorDriver;

  beforeEach(() => {
    world = new World();
    driver = new CodeBehaviorDriver({
      createPort: () => new NodeWorkerPort(),
      timeoutMs: 1000,
    });
  });

  afterEach(() => {
    driver.disposeAll();
  });

  it("await drone.mine() sets state=mine and returns from the tick", async () => {
    const { id: drone, registry } = addDrone(world, "await drone.mine();");

    await tickUntil(
      driver,
      drone,
      world,
      registry,
      () => world.getComponent(drone, "Program")!.state === "mine",
    );

    const program = world.getComponent(drone, "Program")!;
    expect(program.state).toBe("mine");
  });

  it("resolves the awaited action once state returns to running, advancing to the next await", async () => {
    const { id: drone, registry } = addDrone(
      world,
      "await drone.mine(); await drone.charge();",
    );

    await tickUntil(
      driver,
      drone,
      world,
      registry,
      () => world.getComponent(drone, "Program")!.state === "mine",
    );

    // Симулируем, что MiningSystem завершила действие
    world.getComponent(drone, "Program")!.state = "running";

    await tickUntil(
      driver,
      drone,
      world,
      registry,
      () => world.getComponent(drone, "Program")!.state === "charge",
    );

    expect(world.getComponent(drone, "Program")!.state).toBe("charge");
  });

  it("an infinite loop without await is caught by the timeout", async () => {
    const { id: drone, registry } = addDrone(world, "while (true) {}");
    driver = new CodeBehaviorDriver({
      createPort: () => new NodeWorkerPort(),
      timeoutMs: 200,
    });

    await tickUntil(
      driver,
      drone,
      world,
      registry,
      () => world.getComponent(drone, "Program")!.codeError !== undefined,
      400,
    );

    expect(world.getComponent(drone, "Program")!.codeError).toMatch(/timeout/i);
    expect(world.getComponent(drone, "Program")!.state).toBe("idle");
  });

  it("identical code produces an identical state trace (determinism)", async () => {
    async function run(): Promise<string[]> {
      const w = new World();
      const { id: drone, registry } = addDrone(
        w,
        "await drone.mine(); await drone.charge();",
      );
      const d = new CodeBehaviorDriver({
        createPort: () => new NodeWorkerPort(),
        timeoutMs: 1000,
      });
      const trace: string[] = [];
      try {
        await tickUntil(d, drone, w, registry, () => {
          trace.push(w.getComponent(drone, "Program")!.state);
          if (w.getComponent(drone, "Program")!.state === "mine") {
            w.getComponent(drone, "Program")!.state = "running";
          }
          return w.getComponent(drone, "Program")!.state === "charge";
        });
      } finally {
        d.disposeAll();
      }
      return trace;
    }

    // Дедуплицируем последовательные одинаковые состояния: число тиков,
    // которые driver проводит в state==='running' в ожидании ответа воркера,
    // зависит от реальной задержки worker thread (IPC) и не детерминировано
    // по времени. Детерминирована именно последовательность различных
    // состояний, которую driver выставляет в ответ на сообщения воркера.
    function dedupe(trace: string[]): string[] {
      return trace.filter((state, i) => state !== trace[i - 1]);
    }

    const traceA = await run();
    const traceB = await run();
    expect(dedupe(traceA)).toEqual(dedupe(traceB));
  });
});
