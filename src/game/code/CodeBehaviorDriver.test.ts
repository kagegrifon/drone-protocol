import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { World } from "../simulation/world/World.js";
import { Grid } from "../simulation/world/Grid.js";
import { CodeBehaviorDriver } from "./CodeBehaviorDriver.js";
import { NodeWorkerPort } from "./worker/NodeWorkerPort.js";
import type { ProgramRegistry } from "../programs/types.js";
import type { WorldObjectType } from "../../shared/types/index.js";

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

/**
 * Добавляет дрона с entry-программой, импортирующей модуль. Registry содержит
 * две программы: модуль "harvest" (экспортирует функцию) и entry "main",
 * которая её вызывает. Пока тело модуля исполняется, lineStack содержит и
 * строку вызова в entry, и строку внутри модуля — то есть ≥2 кадра.
 */
function addDroneWithModule(world: World) {
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
    currentProgramId: "main",
    callStack: [],
    state: "running",
    commandSlots: 4,
    personalProgramId: "main",
  });

  const harvestModule = `export async function harvest() {
  await self.mine();
}`;
  const mainProgram = `import { harvest } from "harvest";
await harvest();`;

  const registry: ProgramRegistry = new Map([
    [
      "harvest",
      {
        id: "harvest",
        name: "harvest",
        behavior: { sourceForm: "code", code: harvestModule },
      },
    ],
    [
      "main",
      {
        id: "main",
        name: "main",
        behavior: { sourceForm: "code", code: mainProgram },
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

  it("await self.mine() sets state=mine and returns from the tick", async () => {
    const { id: drone, registry } = addDrone(world, "await self.mine();");

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

  it("await self.moveTo(World.mines[0].position) plans a path via planMoveToPoint", async () => {
    const mine = world.createEntity();
    world.addComponent(mine, "Position", { x: 2, y: 0 });
    world.addComponent(mine, "Deposit", { oreRemaining: 5, mineRate: 1 });

    const { id: drone, registry } = addDrone(
      world,
      "await self.moveTo(World.mines[0].position);",
    );

    const typeMap = new Map<number, WorldObjectType>([
      [mine, "mine"],
    ]);
    driver = new CodeBehaviorDriver({
      createPort: () => new NodeWorkerPort(),
      timeoutMs: 1000,
      typeMap,
    });

    await tickUntil(
      driver,
      drone,
      world,
      registry,
      () => world.getComponent(drone, "Program")!.state === "move",
    );

    expect(world.getComponent(drone, "Program")!.state).toBe("move");
    const movement = world.getComponent(drone, "Movement")!;
    expect(movement.targetX).toBe(2);
    expect(movement.targetY).toBe(0);
    expect(movement.path.length).toBeGreaterThan(0);
  });

  it("resolves the awaited action once state returns to running, advancing to the next await", async () => {
    const { id: drone, registry } = addDrone(
      world,
      "await self.mine(); await self.charge();",
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

  it("clears a previous codeError when the code is restarted", async () => {
    const { id: drone, registry } = addDrone(world, "while (true) {}");
    driver = new CodeBehaviorDriver({
      createPort: () => new NodeWorkerPort(),
      timeoutMs: 200,
    });

    // Первый прогон падает по таймауту — codeError выставлен.
    await tickUntil(
      driver,
      drone,
      world,
      registry,
      () => world.getComponent(drone, "Program")!.codeError !== undefined,
      400,
    );
    expect(world.getComponent(drone, "Program")!.codeError).toBeDefined();

    // Перезапуск: убираем сессию (как при reset дрона) и возвращаем running.
    driver.dispose(drone);
    const program = world.getComponent(drone, "Program")!;
    program.state = "running";

    // Следующий step создаёт новую сессию и сбрасывает старую ошибку.
    driver.step(drone, ctx(world, registry));
    expect(world.getComponent(drone, "Program")!.codeError).toBeUndefined();
  });

  it("при исполнении внутри импортированного модуля codeStack содержит ≥2 кадра", async () => {
    const { id: drone, registry } = addDroneWithModule(world);

    await tickUntil(
      driver,
      drone,
      world,
      registry,
      () => world.getComponent(drone, "Program")!.state === "mine",
    );

    const program = world.getComponent(drone, "Program")!;
    const codeStack = program.codeStack!;
    expect(codeStack).toBeTruthy();
    expect(codeStack.length).toBeGreaterThanOrEqual(2);
    // Внешний кадр — entry "main", самый глубокий — модуль "harvest".
    expect(codeStack[0].programId).toBe("main");
    expect(codeStack[codeStack.length - 1].programId).toBe("harvest");
  });

  it("сбрасывает codeStack в null при завершении программы (finished)", async () => {
    const { id: drone, registry } = addDroneWithModule(world);

    // Доводим до первого действия mine, затем «завершаем» его, чтобы код дошёл
    // до конца и воркер прислал finished.
    await tickUntil(
      driver,
      drone,
      world,
      registry,
      () => world.getComponent(drone, "Program")!.state === "mine",
    );
    world.getComponent(drone, "Program")!.state = "running";

    await tickUntil(
      driver,
      drone,
      world,
      registry,
      () => world.getComponent(drone, "Program")!.state === "idle",
    );

    expect(world.getComponent(drone, "Program")!.codeStack).toBeNull();
  });

  it("identical code produces an identical state trace (determinism)", async () => {
    async function run(): Promise<string[]> {
      const w = new World();
      const { id: drone, registry } = addDrone(
        w,
        "await self.mine(); await self.charge();",
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
