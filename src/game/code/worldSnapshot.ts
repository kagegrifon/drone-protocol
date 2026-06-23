import type { EntityId, WorldObjectType } from "../../shared/types/index.js";
import type { World } from "../simulation/world/World.js";
import { freeSlotsCount } from "../simulation/world/workSlots.js";
import type {
  BaseSnap,
  ChargerSnap,
  DroneSnap,
  MineSnap,
  WorldSnapshot,
} from "./types.js";

function droneSnap(world: World, id: EntityId): DroneSnap | null {
  const pos = world.getComponent(id, "Position");
  if (!pos) return null;
  const energy = world.getComponent(id, "Energy");
  const inventory = world.getComponent(id, "Inventory");
  // Look-ahead: если дрон в движении (path непуст), показываем клетку, в
  // которую он едет (path[0]) — код считает moveTo от клетки, до которой дрон
  // обязан доехать. На момент раннего resume Position = уже достигнутая клетка,
  // path[0] = следующая. См. спек continuous-drone-movement (снапшот «на шаг
  // вперёд»).
  const movement = world.getComponent(id, "Movement");
  const cell =
    movement && movement.path.length > 0 ? movement.path[0] : pos;
  return {
    id,
    type: "drone",
    position: { x: cell.x, y: cell.y },
    energy: energy?.current ?? 0,
    energyMax: energy?.max ?? 0,
    inventory: inventory?.ore ?? 0,
    inventoryMax: inventory?.capacity ?? 0,
  };
}

/**
 * Снимает полный снапшот мира на старте тика — синхронный, детерминированный.
 * Статические сущности классифицируются по `typeMap` (из scene.staticEntities),
 * дроны находятся ECS-запросом query("Position","Movement").
 * Снапшот — чистые данные; богатые объекты строятся внутри воркера.
 */
export function collectWorld(
  world: World,
  droneId: EntityId,
  typeMap: ReadonlyMap<EntityId, WorldObjectType>,
): WorldSnapshot {
  const self = droneSnap(world, droneId);
  if (!self) {
    throw new Error(`collectWorld: drone ${droneId} has no Position`);
  }

  const mines: MineSnap[] = [];
  const chargers: ChargerSnap[] = [];
  const bases: BaseSnap[] = [];

  for (const [id, type] of typeMap) {
    const pos = world.getComponent(id, "Position");
    if (!pos) continue; // уничтоженные сущности — пропускаем
    const position = { x: pos.x, y: pos.y };
    const freeSlots = freeSlotsCount(world, id);

    if (type === "mine") {
      const deposit = world.getComponent(id, "Deposit");
      mines.push({
        id,
        type: "mine",
        position,
        oreRemaining: deposit?.oreRemaining ?? 0,
        freeSlots,
      });
    } else if (type === "charger") {
      chargers.push({ id, type: "charger", position, freeSlots });
    } else {
      const inventory = world.getComponent(id, "Inventory");
      bases.push({
        id,
        type: "base",
        position,
        storedOre: inventory?.ore ?? 0,
        freeSlots,
      });
    }
  }

  const drones: DroneSnap[] = [];
  for (const id of world.query("Position", "Movement")) {
    const snap = droneSnap(world, id);
    if (snap) drones.push(snap);
  }

  return { self, mines, chargers, bases, drones };
}
