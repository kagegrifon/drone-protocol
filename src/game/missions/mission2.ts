import { World } from "../simulation/world/World.js";
import { Grid } from "../simulation/world/Grid.js";
import { createBase } from "../simulation/entities/createBase.js";
import { createMine } from "../simulation/entities/createMine.js";
import { createCharger } from "../simulation/entities/createCharger.js";
import { createDrone } from "../simulation/entities/createDrone.js";
import { initWorkSlotsIndex } from "../simulation/world/workSlotsIndex.js";
import { validateNoDroneOnSlot } from "../simulation/world/workSlots.js";
import type { MissionDef } from "./types.js";
import type { ProgramDef, ProgramRegistry } from "../programs/types.js";

export const mission2: MissionDef = {
  id: "mission2",
  title: "Миссия 2: Управление энергией",
  description:
    "Дрон тратит энергию при движении и добыче (1 ед./шаг, 2 ед./руда). Добавь два условия: при низкой энергии и пустом трюме — MOVE_TO(charger); у зарядки — CHARGE. Иначе дрон остановится.",
  goalText: "Добыть 80 руды",
  config: {
    win: { type: "ore_mined", target: 80 },
    // fail: { type: 'time_limit', maxTicks: 900 },
  },
  buildScene() {
    const world = new World();
    const grid = new Grid(30, 30);
    const registry: ProgramRegistry = new Map();

    grid.setTile(1, 1, "base");
    grid.setTile(15, 3, "mine");
    grid.setTile(1, 10, "charger");

    const baseId = createBase(world, 1, 1);
    const mineId = createMine(world, 15, 3);
    const chargerId = createCharger(world, 1, 10);
    const droneId = createDrone(world, 5, 5);

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
        { id: chargerId, type: "charger" },
      ],
    };
  },
};
