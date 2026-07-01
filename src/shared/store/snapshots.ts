import type { EntityId, WorldObjectType } from "../types/index.js";
import type { World } from "@/game/simulation/world/World.js";
import type { ProgramRegistry, ProgramDef } from "@/game/programs/types.js";
import { computeActivePath } from "./computeActivePath.js";
import type { DroneState, BuildingState } from "./types.js";

export function filterPrograms(registry: ProgramRegistry): ProgramDef[] {
  return Array.from(registry.values()).filter((p) => !p.personal);
}

export function resetDroneProgram(world: World, droneId: EntityId): void {
  const program = world.getComponent(droneId, "Program");
  if (!program || !program.currentProgramId) return;
  program.callStack = [
    { programId: program.currentProgramId, instructionIndex: 0 },
  ];
  program.state = "running";
  program.mineProgress = undefined;
  program.chargeProgress = undefined;
  program.dropProgress = undefined;
  const movement = world.getComponent(droneId, "Movement");
  if (movement) {
    movement.path = [];
    movement.progress = 0;
  }
}

export function snapshotDrones(world: World): DroneState[] {
  const ids = world.query("Position", "Energy", "Inventory", "Program");
  return ids.map((id) => {
    const pos = world.getComponent(id, "Position")!;
    const energy = world.getComponent(id, "Energy")!;
    const inventory = world.getComponent(id, "Inventory")!;
    const program = world.getComponent(id, "Program")!;

    let currentInstruction = "—";
    const frame = program.callStack[program.callStack.length - 1];
    if (frame) {
      const isWaiting =
        (program.state !== "idle" && program.state !== "running") ||
        (frame.waitRemaining !== undefined && frame.waitRemaining > 0);
      const idx = isWaiting
        ? frame.instructionIndex - 1
        : frame.instructionIndex;
      if (idx >= 0) {
        currentInstruction = "-TODO-"; // понять что тут выводить
      }
    }

    return {
      id,
      position: { x: pos.x, y: pos.y },
      energy: { current: energy.current, max: energy.max },
      inventory: { ore: inventory.ore, capacity: inventory.capacity },
      programState: program.state,
      currentInstruction,
      currentProgramId: program.currentProgramId,
      currentInstructionPath: computeActivePath(
        program.callStack,
        program.state,
      ),
      personalProgramId: program.personalProgramId,
      assignedProgramId: program.assignedProgramId,
      localPaused: program.localPaused ?? false,
      codeError: program.codeError,
      currentLine: program.currentLine ?? null,
      codeStack: program.codeStack ?? null,
    };
  });
}

/** Множественное число типа здания для рефа: mine → mines и т.д. */
export const REF_ARRAY_BY_TYPE: Record<WorldObjectType, string> = {
  mine: "mines",
  base: "bases",
  charger: "chargers",
};

/**
 * Срез зданий для React. Порядок и классификация — как в collectWorld:
 * итерация по typeMap, поэтому индекс внутри массива своего типа совпадает
 * с индексом в World API (`World.mines[0]`).
 */
export function snapshotBuildings(
  world: World,
  typeMap: ReadonlyMap<EntityId, WorldObjectType>,
): BuildingState[] {
  const indexByType: Record<WorldObjectType, number> = {
    mine: 0,
    base: 0,
    charger: 0,
  };
  const buildings: BuildingState[] = [];

  for (const [entityId, type] of typeMap) {
    const pos = world.getComponent(entityId, "Position");
    if (!pos) continue; // уничтоженные сущности — пропускаем

    const index = indexByType[type]++;
    const ref = `World.${REF_ARRAY_BY_TYPE[type]}[${index}]`;

    const building: BuildingState = { entityId, type, x: pos.x, y: pos.y, ref };
    if (type === "mine") {
      const deposit = world.getComponent(entityId, "Deposit");
      building.oreRemaining = deposit?.oreRemaining ?? 0;
    }
    buildings.push(building);
  }

  return buildings;
}
