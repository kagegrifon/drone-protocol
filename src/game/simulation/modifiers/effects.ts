import type { ModifierId } from '../components/Modifiers.js';
import { DRAINED_SPEED_MUL, OVERLOAD_THRESHOLDS } from '../constants.js';

export function getMoveSpeedMul(active: ModifierId[]): number {
  let mul = 1;
  for (const m of active) {
    if (m === 'drained') {
      mul *= DRAINED_SPEED_MUL;
    } else {
      const threshold = OVERLOAD_THRESHOLDS.find(t => t.id === m);
      if (threshold) mul *= threshold.mul;
    }
  }
  return mul;
}

export function canMine(active: ModifierId[]): boolean {
  return !active.includes('drained');
}

export function canDrop(active: ModifierId[]): boolean {
  return !active.includes('drained');
}
