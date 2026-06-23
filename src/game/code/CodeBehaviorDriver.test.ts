import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { World } from "../simulation/world/World.js";
import { Grid } from "../simulation/world/Grid.js";
import { CodeBehaviorDriver } from "./CodeBehaviorDriver.js";
import { NodeWorkerPort } from "./worker/NodeWorkerPort.js";
import type { ProgramRegistry } from "../programs/types.js";
import type { WorldObjectType } from "../../shared/types/index.js";
import { gameEvents } from "../../shared/events/gameEvents.js";

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

  it("await self.moveTo(point) plans EXACTLY one step (single-step model)", async () => {
    // moveTo = один шаг: path содержит ровно следующую клетку, не весь путь.
    // После шага path пустеет → state=running → управление возвращается в код игрока.
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
    // Ровно один шаг — не весь путь до (2,0).
    expect(movement.path).toEqual([{ x: 1, y: 0 }]);
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

  it("early resume on drone:moved: ONE step() after reaching target is enough to start next moveTo", async () => {
    // Ранний resume отправляется на drone:moved когда path пустой (дрон достиг цели).
    // Воркер отвечает за ~15ms → один step() через 50ms читает pending и ставит следующий moveTo.
    const { id: drone, registry } = addDrone(
      world,
      "await self.moveTo({x:1,y:0}); await self.moveTo({x:2,y:0});",
    );

    await tickUntil(
      driver,
      drone,
      world,
      registry,
      () => world.getComponent(drone, "Program")!.state === "move",
    );

    // Симулируем завершение всего пути MovementSystem: позиция обновлена, path очищен, state=running
    world.getComponent(drone, "Position")!.x = 1;
    world.getComponent(drone, "Movement")!.path = []; // путь пройден
    world.getComponent(drone, "Program")!.state = "running";
    gameEvents.emit("drone:moved", { droneId: drone, fromX: 0, fromY: 0, toX: 1, toY: 0 });

    // Ждём достаточно для воркера (~15ms реально, берём 50ms с запасом)
    await new Promise((r) => setTimeout(r, 50));

    // Один step() — драйвер должен читать уже готовый pending (ранний resume отправлен по событию)
    driver.step(drone, ctx(world, registry));

    // Без раннего resume state был бы "running" (pending ещё не готов)
    expect(world.getComponent(drone, "Program")!.state).toBe("move");
  });

  it("mine action does NOT get early resume on drone:moved (lastAction !== moveTo)", async () => {
    const { id: drone, registry } = addDrone(world, "await self.mine();");

    await tickUntil(
      driver,
      drone,
      world,
      registry,
      () => world.getComponent(drone, "Program")!.state === "mine",
    );

    // Эмитируем drone:moved — для mine ранний resume не должен отправляться
    gameEvents.emit("drone:moved", { droneId: drone, fromX: 0, fromY: 0, toX: 1, toY: 0 });

    // Ждём, тикаем без изменения state — если бы resume отправился, воркер ответил бы
    // и на следующем step() state изменился бы. Но mine должен ждать систем.
    await new Promise((r) => setTimeout(r, 50));
    driver.step(drone, ctx(world, registry));

    // state mine — resume не был отправлен, воркер ещё не ответил
    expect(world.getComponent(drone, "Program")!.state).toBe("mine");
  });

  it("drone:blocked suppresses early resume, so ONE step() after event leaves state=running", async () => {
    const { id: drone, registry } = addDrone(
      world,
      "await self.moveTo({x:1,y:0}); await self.moveTo({x:2,y:0});",
    );

    await tickUntil(
      driver,
      drone,
      world,
      registry,
      () => world.getComponent(drone, "Program")!.state === "move",
    );

    // Эмитируем drone:blocked — ранний resume НЕ должен отправляться
    gameEvents.emit("drone:blocked", { droneId: drone });

    // MovementSystem вернёт state в running
    world.getComponent(drone, "Program")!.state = "running";

    await new Promise((r) => setTimeout(r, 50));

    // Один step() — без раннего resume pending ещё пустой (resume не был отправлен),
    // driver видит action-pending + state=running → отправляет resume, но воркер ещё не ответил
    driver.step(drone, ctx(world, registry));

    // pending ещё не пришёл — state должен оставаться running
    expect(world.getComponent(drone, "Program")!.state).toBe("running");
  });

  it("plans the next single step after each moveTo (continuous via repeated single steps)", async () => {
    // Дрон в (1,0) после первого шага. Воркер на раннем resume снова шлёт moveTo
    // к {x:3,y:0} → driver планирует РОВНО следующий шаг (2,0) через planNextStep,
    // не сбрасывая progress. Так непрерывность складывается из отдельных шагов.
    const mine = world.createEntity();
    world.addComponent(mine, "Position", { x: 3, y: 0 });
    world.addComponent(mine, "Deposit", { oreRemaining: 5, mineRate: 1 });
    const typeMap = new Map<number, WorldObjectType>([[mine, "mine"]]);
    driver = new CodeBehaviorDriver({
      createPort: () => new NodeWorkerPort(),
      timeoutMs: 1000,
      typeMap,
    });

    const { id: drone, registry } = addDrone(
      world,
      "while (true) { await self.moveTo(World.mines[0].position); }",
    );

    await tickUntil(
      driver,
      drone,
      world,
      registry,
      () => world.getComponent(drone, "Program")!.state === "move",
    );

    // Симулируем шаг MovementSystem: дрон шагнул в (1,0), path пуст, state=running.
    world.getComponent(drone, "Position")!.x = 1;
    world.getComponent(drone, "Movement")!.path = [];
    world.getComponent(drone, "Movement")!.progress = 0;
    world.getComponent(drone, "Program")!.state = "running";
    gameEvents.emit("drone:moved", {
      droneId: drone,
      fromX: 0,
      fromY: 0,
      toX: 1,
      toY: 0,
    });

    await new Promise((r) => setTimeout(r, 50));
    driver.step(drone, ctx(world, registry));

    // Та же цель → driver дописал следующий шаг к (3,0): следующий шаг (2,0).
    const m = world.getComponent(drone, "Movement")!;
    expect(m.targetX).toBe(3);
    expect(m.path).toEqual([{ x: 2, y: 0 }]);
    expect(world.getComponent(drone, "Program")!.state).toBe("move");
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
