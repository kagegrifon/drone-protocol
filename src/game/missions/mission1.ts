import { World } from "../simulation/world/World.js";
import { Grid } from "../simulation/world/Grid.js";
import { createBase } from "../simulation/entities/createBase.js";
import { createMine } from "../simulation/entities/createMine.js";
import { createDrone } from "../simulation/entities/createDrone.js";
import { initWorkSlotsIndex } from "../simulation/world/workSlotsIndex.js";
import { validateNoDroneOnSlot } from "../simulation/world/workSlots.js";
import type { MissionDef } from "./types.js";
import type { ProgramDef, ProgramRegistry } from "../programs/types.js";

export const mission1: MissionDef = {
  id: "mission1",
  title: "Миссия 1: Первые шаги",
  description:
    "Каждый тик LOOP дрон проверяет условия. Построй программу из четырёх блоков: у шахты и трюм пуст — MINE; есть руда — MOVE_TO(base); у базы и есть руда — DROP; трюм пуст — MOVE_TO(mine).",
  goalText: "Добыть 50 руды",
  config: {
    win: { type: "ore_mined", target: 50 },
    // fail: { type: 'time_limit', maxTicks: 600 },
  },
  buildScene() {
    const world = new World();
    const grid = new Grid(30, 30);
    const registry: ProgramRegistry = new Map();

    grid.setTile(1, 1, "base");
    grid.setTile(15, 3, "mine");

    const baseId = createBase(world, 1, 1);
    const mineId = createMine(world, 15, 3);
    const droneId = createDrone(world, 5, 5);

    const energy = world.getComponent(droneId, "Energy")!;
    energy.drainPerMove = 0;
    energy.drainPerMine = 0;

    // Personal program for drone
    const personalProg: ProgramDef = {
      id: String(droneId),
      name: `drone-${droneId}`,
      personal: true,
      behavior: { sourceForm: "code", code: "" },
    };
    registry.set(personalProg.id, personalProg);
    const prog = world.getComponent(droneId, "Program")!;
    prog.personalProgramId = String(droneId);
    prog.currentProgramId = personalProg.id;
    prog.callStack = [{ programId: personalProg.id, instructionIndex: 0 }];
    prog.state = "running";

    initWorkSlotsIndex(world);
    validateNoDroneOnSlot(world);

    return {
      world,
      grid,
      registry,
      baseId,
      staticEntities: [
        { id: baseId, type: "base" },
        { id: mineId, type: "mine" },
      ],
    };
  },
};
