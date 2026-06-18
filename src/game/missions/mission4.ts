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

export const mission4: MissionDef = {
  id: "mission4",
  title: "Миссия 4: Подпрограммы",
  description:
    "Дроны работают, но разряжаются и останавливаются. Создай подпрограмму зарядки и подключи через RUN_PROGRAM.",
  goalText: "Достичь 8 руды/мин",
  config: {
    win: { type: "ore_per_min", target: 8 },
    // fail: { type: 'time_limit', maxTicks: 1000 },
  },
  buildScene() {
    const world = new World();
    const grid = new Grid(30, 30);
    const registry: ProgramRegistry = new Map();

    grid.setTile(1, 1, "base");
    grid.setTile(15, 3, "mine");
    grid.setTile(3, 15, "mine");
    grid.setTile(17, 15, "mine");
    grid.setTile(1, 10, "charger");
    grid.setTile(10, 1, "charger");

    const baseId = createBase(world, 1, 1);
    const mine1Id = createMine(world, 15, 3);
    const mine2Id = createMine(world, 3, 15);
    const mine3Id = createMine(world, 17, 15);
    const charger1Id = createCharger(world, 1, 10);
    const charger2Id = createCharger(world, 10, 1);
    const drone1Id = createDrone(world, 4, 4);
    const drone2Id = createDrone(world, 12, 12);

    const loop1: ProgramDef = {
      id: "loop-m4-d1",
      name: "mine-no-charge",
      behavior: { sourceForm: "code", code: "" },
    };

    const loop2: ProgramDef = {
      id: "loop-m4-d2",
      name: "mine-no-charge",
      behavior: { sourceForm: "code", code: "" },
    };

    registry.set(loop1.id, loop1);
    registry.set(loop2.id, loop2);

    const prog1 = world.getComponent(drone1Id, "Program")!;
    prog1.currentProgramId = loop1.id;
    prog1.callStack = [{ programId: loop1.id, instructionIndex: 0 }];
    prog1.state = "running";

    const prog2 = world.getComponent(drone2Id, "Program")!;
    prog2.currentProgramId = loop2.id;
    prog2.callStack = [{ programId: loop2.id, instructionIndex: 0 }];
    prog2.state = "running";

    // Personal program for drone1
    const personal1: ProgramDef = {
      id: String(drone1Id),
      name: `drone-${drone1Id}`,
      personal: true,
      behavior: { sourceForm: "code", code: "" },
    };
    registry.set(personal1.id, personal1);
    const p1 = world.getComponent(drone1Id, "Program")!;
    p1.personalProgramId = String(drone1Id);
    p1.assignedProgramId = loop1.id;

    // Personal program for drone2
    const personal2: ProgramDef = {
      id: String(drone2Id),
      name: `drone-${drone2Id}`,
      personal: true,
      behavior: { sourceForm: "code", code: "" },
    };
    registry.set(personal2.id, personal2);
    const p2 = world.getComponent(drone2Id, "Program")!;
    p2.personalProgramId = String(drone2Id);
    p2.assignedProgramId = loop2.id;

    initWorkSlotsIndex(world);
    validateNoDroneOnSlot(world);

    return {
      world,
      grid,
      registry,
      baseId,
      staticEntities: [
        { id: baseId, type: "base" },
        { id: mine1Id, type: "mine" },
        { id: mine2Id, type: "mine" },
        { id: mine3Id, type: "mine" },
        { id: charger1Id, type: "charger" },
        { id: charger2Id, type: "charger" },
      ],
    };
  },
};
