import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "./gameStore.js";
import { World } from "../../game/simulation/world/World.js";
import { Grid } from "../../game/simulation/world/Grid.js";
import type {
  ProgramRegistry,
  ProgramDef,
  Instruction,
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

// ─── pauseDrone / startDrone / resetDrone ────────────────────────────────────

describe("store.pauseDrone / startDrone / resetDrone", () => {
  function setup() {
    const prog: ProgramDef = {
      id: "p1",
      name: "Test",
      instructions: [{ type: "MINE" }],
    };
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
    const prog: ProgramDef = {
      id: "p1",
      name: "Test",
      instructions: [{ type: "MINE" }],
    };
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
    const prog: ProgramDef = {
      id: "p1",
      name: "Test",
      instructions: [{ type: "MOVE_TO", targetEntityId: 99 }],
    };
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
    const prog: ProgramDef = { id: "p1", name: "Test", instructions: [] };
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

// ─── moveInstruction ─────────────────────────────────────────────────────────

describe("store.moveInstruction()", () => {
  function setup(instructions: Instruction[]) {
    const prog: ProgramDef = { id: "p1", name: "Test", instructions };
    const registry: ProgramRegistry = new Map([["p1", prog]]);
    useGameStore.getState().init(makeWorld(), makeGrid(), registry);
    return "p1";
  }

  it("перемещает блок в том же списке: root[2] → позиция 0", () => {
    const id = setup([{ type: "MINE" }, { type: "DROP" }, { type: "CHARGE" }]);
    useGameStore.getState().moveInstruction(id, [2], [], 0);
    const prog = useGameStore.getState().programs.find((p) => p.id === id)!;
    expect(prog.instructions.map((i) => i.type)).toEqual([
      "CHARGE",
      "MINE",
      "DROP",
    ]);
  });

  it("перемещает блок в том же списке: root[0] → позиция 2", () => {
    const id = setup([{ type: "MINE" }, { type: "DROP" }, { type: "CHARGE" }]);
    useGameStore.getState().moveInstruction(id, [0], [], 2);
    const prog = useGameStore.getState().programs.find((p) => p.id === id)!;
    expect(prog.instructions.map((i) => i.type)).toEqual([
      "DROP",
      "CHARGE",
      "MINE",
    ]);
  });

  it("перемещает блок из корня внутрь LOOP", () => {
    const id = setup([
      { type: "LOOP", body: [{ type: "DROP" }] },
      { type: "MINE" },
    ]);
    useGameStore.getState().moveInstruction(id, [1], [0], 0);
    const prog = useGameStore.getState().programs.find((p) => p.id === id)!;
    expect(prog.instructions).toHaveLength(1);
    const loop = prog.instructions[0] as Extract<Instruction, { type: "LOOP" }>;
    expect(loop.body.map((i) => i.type)).toEqual(["MINE", "DROP"]);
  });

  it("перемещает блок из LOOP в корень", () => {
    const id = setup([
      { type: "LOOP", body: [{ type: "DROP" }, { type: "MINE" }] },
      { type: "CHARGE" },
    ]);
    useGameStore.getState().moveInstruction(id, [0, 0], [], 1);
    const prog = useGameStore.getState().programs.find((p) => p.id === id)!;
    expect(prog.instructions.map((i) => i.type)).toEqual([
      "LOOP",
      "DROP",
      "CHARGE",
    ]);
    const loop = prog.instructions[0] as Extract<Instruction, { type: "LOOP" }>;
    expect(loop.body.map((i) => i.type)).toEqual(["MINE"]);
  });

  it("перемещение между двумя разными контейнерами", () => {
    const id = setup([
      { type: "LOOP", body: [{ type: "CHARGE" }] },
      { type: "REPEAT", count: 2, body: [{ type: "DROP" }] },
    ]);
    useGameStore.getState().moveInstruction(id, [1, 0], [0], 0);
    const prog = useGameStore.getState().programs.find((p) => p.id === id)!;
    const loop = prog.instructions[0] as Extract<Instruction, { type: "LOOP" }>;
    const repeat = prog.instructions[1] as Extract<
      Instruction,
      { type: "REPEAT" }
    >;
    expect(loop.body.map((i) => i.type)).toEqual(["DROP", "CHARGE"]);
    expect(repeat.body).toHaveLength(0);
  });

  it("перемещение из корня внутрь контейнера с корректировкой пути", () => {
    const id = setup([
      { type: "MINE" },
      { type: "LOOP", body: [{ type: "CHARGE" }] },
    ]);
    // Move root[0] (MINE) inside root[1].body (LOOP) — after removal root[1] becomes root[0]
    useGameStore.getState().moveInstruction(id, [0], [1], 0);
    const prog = useGameStore.getState().programs.find((p) => p.id === id)!;
    expect(prog.instructions).toHaveLength(1);
    const loop = prog.instructions[0] as Extract<Instruction, { type: "LOOP" }>;
    expect(loop.body.map((i) => i.type)).toEqual(["MINE", "CHARGE"]);
  });
});
