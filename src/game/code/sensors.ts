import type { EntityId } from "../../shared/types/index.js";
import type { World } from "../simulation/world/World.js";
import { freeSlotsCount } from "../simulation/world/workSlots.js";
import type { SensorsSnapshot } from "./types.js";

/**
 * Снимает сенсоры дрона и всех именованных сущностей-целей на старте тика.
 * Снапшот передаётся в воркер, чтобы геттеры drone.* и distance()/deposit()
 * были консистентны в пределах одного тика (детерминизм).
 */
export function collectSensors(
  world: World,
  droneId: EntityId,
  entities: Record<string, EntityId>,
): SensorsSnapshot {
  const energy = world.getComponent(droneId, "Energy");
  const inventory = world.getComponent(droneId, "Inventory");
  const dronePos = world.getComponent(droneId, "Position");

  const positions: Record<EntityId, { x: number; y: number }> = {};
  const deposits: Record<EntityId, number> = {};

  if (dronePos) positions[droneId] = { x: dronePos.x, y: dronePos.y };

  for (const id of Object.values(entities)) {
    const pos = world.getComponent(id, "Position");
    if (pos) positions[id] = { x: pos.x, y: pos.y };
    const deposit = world.getComponent(id, "Deposit");
    if (deposit) deposits[id] = deposit.oreRemaining;
  }

  return {
    energy: energy?.current ?? 0,
    energyMax: energy?.max ?? 0,
    inventory: inventory?.ore ?? 0,
    inventoryMax: inventory?.capacity ?? 0,
    freeSlots: world.getComponent(droneId, "WorkSlots")
      ? freeSlotsCount(world, droneId)
      : 0,
    positions,
    deposits,
  };
}
