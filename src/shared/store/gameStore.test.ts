import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "./gameStore.js";
import { World } from "../../game/simulation/world/World.js";
import { Grid } from "../../game/simulation/world/Grid.js";
import type { ProgramState } from "../../game/simulation/components/Program.js";
import type {
  ProgramRegistry,
  ProgramDef,
} from "../../game/programs/types.js";

function makeWorld(): World {
  return new World();
}

function makeGrid(): Grid {
  return new Grid();
}

function makeRegistry(): ProgramRegistry {
  return new Map();
}

// Сбрасываем store перед каждым тестом через повторный init
beforeEach(() => {
  useGameStore.getState().init(makeWorld(), makeGrid(), makeRegistry());
});

// ─── БАГ 3: store.init() не сбрасывал _tickCount ─────────────────────────────
//
// До фикса: повторный вызов init() (при reset/смене миссии) оставлял
// _tickCount и stats.tick на прежнем значении.

describe("store.init() — сброс счётчика тиков", () => {
  it("tick равен 0 сразу после init()", () => {
    const { stats } = useGameStore.getState();
    expect(stats.tick).toBe(0);
  });

  it("после нескольких tick() и повторного init() счётчик сбрасывается в 0", () => {
    const store = useGameStore.getState();

    // Накапливаем тики (имитируем игровую сессию)
    store.tick();
    store.tick();
    store.tick();
    expect(useGameStore.getState().stats.tick).toBe(3);

    // Повторный init() — как при "Заново" или смене миссии
    useGameStore.getState().init(makeWorld(), makeGrid(), makeRegistry());

    expect(useGameStore.getState().stats.tick).toBe(0);
  });

  it("после повторного init() все поля stats обнуляются", () => {
    useGameStore.getState().tick();
    useGameStore.getState().tick();

    useGameStore.getState().init(makeWorld(), makeGrid(), makeRegistry());

    const { stats } = useGameStore.getState();
    expect(stats.tick).toBe(0);
    expect(stats.oreMined).toBe(0);
    expect(stats.orePerMin).toBe(0);
    expect(stats.efficiency).toBe(0);
    expect(stats.congestion).toBe(0);
  });

  it("после повторного init() gameStatus сбрасывается в idle", () => {
    useGameStore.getState().setGameStatus("failed", "время вышло");
    expect(useGameStore.getState().gameStatus).toBe("failed");

    useGameStore.getState().init(makeWorld(), makeGrid(), makeRegistry());

    expect(useGameStore.getState().gameStatus).toBe("idle");
    expect(useGameStore.getState().statusMessage).toBeNull();
  });
});

// ─── restartProgram ───────────────────────────────────────────────────────────

function makeWorldWithDrone(
  programId: string,
  prog: ProgramDef,
): { world: World; registry: ProgramRegistry; droneId: number } {
  const world = new World();
  const registry: ProgramRegistry = new Map([[programId, prog]]);

  const droneId = world.createEntity();
  world.addComponent(droneId, "Position", { x: 0, y: 0 });
  world.addComponent(droneId, "Energy", {
    current: 100,
    max: 100,
    drainPerMove: 0,
    drainPerMine: 0,
  });
  world.addComponent(droneId, "Inventory", { ore: 0, capacity: 10 });
  world.addComponent(droneId, "Movement", {
    targetX: 0,
    targetY: 0,
    path: [],
    progress: 0,
    speed: 1,
  });
  world.addComponent(droneId, "Program", {
    currentProgramId: programId,
    callStack: [{ programId, instructionIndex: 0 }],
    state: "running",
    commandSlots: 4,
    personalProgramId: "",
  });

  return { world, registry, droneId };
}

function makeCodeProgram(id: string, code = ""): ProgramDef {
  return { id, name: "Test", behavior: { sourceForm: "code", code } };
}

// ─── pauseDrone / startDrone / resetDrone ────────────────────────────────────

describe("store.pauseDrone / startDrone / resetDrone", () => {
  function setup() {
    const prog = makeCodeProgram("p1", "await self.mine();");
    const { world, registry, droneId } = makeWorldWithDrone("p1", prog);
    useGameStore.getState().init(world, new Grid(), registry);
    return { world, registry, droneId };
  }

  it("pauseDrone устанавливает localPaused=true", () => {
    const { droneId } = setup();
    useGameStore.getState().pauseDrone(droneId);
    const droneState = useGameStore
      .getState()
      .drones.find((d) => d.id === droneId);
    expect(droneState?.localPaused).toBe(true);
  });

  it("startDrone сбрасывает localPaused в false", () => {
    const { world, droneId } = setup();
    world.getComponent(droneId, "Program")!.localPaused = true;
    useGameStore.getState().startDrone(droneId);
    const droneState = useGameStore
      .getState()
      .drones.find((d) => d.id === droneId);
    expect(droneState?.localPaused).toBe(false);
  });

  it("resetDrone сбрасывает программу и снимает localPaused", () => {
    const { world, droneId } = setup();
    const program = world.getComponent(droneId, "Program")!;
    program.localPaused = true;
    program.mineProgress = 0.6;
    program.callStack = [];
    program.state = "idle";

    useGameStore.getState().resetDrone(droneId);

    expect(program.localPaused).toBe(false);
    expect(program.mineProgress).toBeUndefined();
    expect(program.state).toBe("running");
    expect(program.callStack).toHaveLength(1);
  });

  it("resetDrone обновляет снапшот drones", () => {
    const { world, droneId } = setup();
    world.getComponent(droneId, "Program")!.localPaused = true;
    useGameStore.getState().resetDrone(droneId);
    const droneState = useGameStore
      .getState()
      .drones.find((d) => d.id === droneId);
    expect(droneState?.localPaused).toBe(false);
    expect(droneState?.programState).toBe("running");
  });
});

describe("store.restartProgram()", () => {
  it("сбрасывает callStack и переводит дрона в state=running", () => {
    const prog = makeCodeProgram("p1", "await self.mine();");
    const { world, registry, droneId } = makeWorldWithDrone("p1", prog);
    useGameStore.getState().init(world, new Grid(), registry);

    // Имитируем, что дрон выполнил инструкцию и стал idle
    const program = world.getComponent(droneId, "Program")!;
    program.callStack = [];
    program.state = "idle";

    useGameStore.getState().restartProgram(droneId);

    expect(program.state).toBe("running");
    expect(program.callStack).toHaveLength(1);
    expect(program.callStack[0].programId).toBe("p1");
    expect(program.callStack[0].instructionIndex).toBe(0);
  });

  it("сбрасывает состояние действия и путь движения", () => {
    const prog = makeCodeProgram("p1", "await self.moveTo({ x: 9, y: 9 });");
    const { world, registry, droneId } = makeWorldWithDrone("p1", prog);
    useGameStore.getState().init(world, new Grid(), registry);

    // Имитируем дрона в процессе движения
    const program = world.getComponent(droneId, "Program")!;
    program.state = "move";
    const movement = world.getComponent(droneId, "Movement")!;
    movement.path = [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    movement.progress = 0.5;

    useGameStore.getState().restartProgram(droneId);

    expect(program.state).toBe("running");
    expect(movement.path).toHaveLength(0);
    expect(movement.progress).toBe(0);
  });

  it("обновляет снапшот drones в store", () => {
    const prog = makeCodeProgram("p1");
    const { world, registry, droneId } = makeWorldWithDrone("p1", prog);
    useGameStore.getState().init(world, new Grid(), registry);

    const program = world.getComponent(droneId, "Program")!;
    program.callStack = [];
    program.state = "idle";

    useGameStore.getState().restartProgram(droneId);

    const droneState = useGameStore
      .getState()
      .drones.find((d) => d.id === droneId);
    expect(droneState?.programState).toBe("running");
  });
});

// ─── createProgram() ─────────────────────────────────────────────────────────

describe("store.createProgram()", () => {
  it("создаёт программу с sourceForm='code'", () => {
    useGameStore.getState().createProgram("Test program");

    const prog = useGameStore
      .getState()
      .programs.find((p) => p.name === "Test program")!;
    expect(prog).toBeDefined();
    expect(prog.behavior.sourceForm).toBe("code");
  });
});

// ─── programs — фильтрация personal/library ─────────────────────────────────

describe("store.programs — фильтрация", () => {
  function setupRegistry(): ProgramRegistry {
    const registry: ProgramRegistry = new Map();
    registry.set("personal-prog", {
      id: "personal-prog",
      name: "Personal program",
      personal: true,
      behavior: { sourceForm: "code", code: "" },
    });
    registry.set("library-prog", {
      id: "library-prog",
      name: "Library program",
      behavior: { sourceForm: "code", code: "" },
    });
    return registry;
  }

  it("показывает только библиотечные (не personal) программы", () => {
    useGameStore.getState().init(makeWorld(), makeGrid(), setupRegistry());

    const names = useGameStore.getState().programs.map((p) => p.name);
    expect(names).toContain("Library program");
    expect(names).not.toContain("Personal program");
  });
});

// ─── init() — подключение CodeBehaviorDriver ─────────────────────────────────

describe("store.init() — CodeBehaviorDriver подключён через ProgramExecutionSystem", () => {
  it("дрон с personal-программой sourceForm='code' выполняет код через store.tick()", async () => {
    const { NodeWorkerPort } = await import(
      "../../game/code/worker/NodeWorkerPort.js"
    );

    const prog: ProgramDef = {
      id: "p1",
      name: "Personal",
      personal: true,
      behavior: { sourceForm: "code", code: "await self.mine();" },
    };
    const { world, registry } = makeWorldWithDrone("p1", prog);
    const depositId = world.createEntity();
    world.addComponent(depositId, "Position", { x: 0, y: 0 });
    world.addComponent(depositId, "Deposit", { oreRemaining: 10, mineRate: 1 });

    const program = world.getComponent(
      world.query("Position", "Energy", "Inventory", "Program")[0],
      "Program",
    )!;
    program.personalProgramId = "p1";
    program.currentProgramId = null;

    useGameStore.getState().init(world, new Grid(), registry, {
      createPort: () => new NodeWorkerPort(),
    });

    let state: ProgramState = "idle";
    for (let i = 0; i < 50; i++) {
      useGameStore.getState().tick();
      state = world.getComponent(
        world.query("Position", "Energy", "Inventory", "Program")[0],
        "Program",
      )!.state;
      if (state === "mine") break;
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(state).toBe("mine");
  }, 5000);
});
