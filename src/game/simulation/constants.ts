import type { World } from "./world/World.js";
import type { EntityId } from "../../shared/types/index.js";

export const DT = 0.1;
export const EPSILON = 1e-6;

// Скорости действий: значение — «действий в секунду» (чем больше, тем быстрее).
// Например, BASE_MINE_SPEED = 2 ⇒ одна операция mine длится 1/2 = 0.5 секунды.
export const BASE_MINE_SPEED = 2;
export const BASE_CHARGE_SPEED = 10;
export const BASE_DROP_SPEED = 5;
export const DEFAULT_DRONE_SPEED = 4;

export function getMineSpeed(_world: World, _droneId: EntityId): number {
  return BASE_MINE_SPEED;
  // future: return BASE_MINE_SPEED * (drone.mineSpeedMultiplier ?? 1.0)
}

export function getChargeSpeed(_world: World, _droneId: EntityId): number {
  return BASE_CHARGE_SPEED;
}

export function getDropSpeed(_world: World, _droneId: EntityId): number {
  return BASE_DROP_SPEED;
}

export const DRAINED_SPEED_MUL = 0.5;
export const DRAINED_EXIT_RATIO = 0.05; // 5% of max energy
export const OVERLOAD_THRESHOLDS = [
  { minRatio: 0.3, mul: 0.9, id: "overloaded:light" as const },
  { minRatio: 0.5, mul: 0.8, id: "overloaded:medium" as const },
  { minRatio: 0.7, mul: 0.7, id: "overloaded:heavy" as const },
] as const;

