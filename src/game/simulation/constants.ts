import type { World } from './world/World.js';
import type { EntityId } from '../../shared/types/index.js';

export const DT = 0.1;
export const EPSILON = 1e-6;

export const BASE_MINE_DURATION_PER_ORE = 2.0;
export const BASE_CHARGE_DURATION_PER_UNIT = 0.5;
export const BASE_DROP_DURATION_PER_ORE = 0.5;
export const DEFAULT_DRONE_SPEED = 1.0;

export function getMineDuration(_world: World, _droneId: EntityId): number {
  return BASE_MINE_DURATION_PER_ORE;
  // future: return BASE_MINE_DURATION_PER_ORE / (drone.mineSpeedMultiplier ?? 1.0)
}

export function getChargeDuration(_world: World, _droneId: EntityId): number {
  return BASE_CHARGE_DURATION_PER_UNIT;
}

export function getDropDuration(_world: World, _droneId: EntityId): number {
  return BASE_DROP_DURATION_PER_ORE;
}

export function getMoveSpeed(_world: World, _droneId: EntityId): number {
  return DEFAULT_DRONE_SPEED;
}
