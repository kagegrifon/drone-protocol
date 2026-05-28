import type { EntityId } from '../../../shared/types/index.js';
import type { World } from './World.js';
import type { WorkSlot } from '../components/WorkSlots.js';
import { getSlotRefAt } from './workSlotsIndex.js';

export function slotsOf(world: World, entityId: EntityId): readonly WorkSlot[] {
  return world.getComponent(entityId, 'WorkSlots')?.slots ?? [];
}

export function freeSlotsCount(world: World, entityId: EntityId): number {
  const ws = world.getComponent(entityId, 'WorkSlots');
  if (!ws) return 0;
  return ws.slots.filter(s => s.occupiedBy === null).length;
}

export function validateNoDroneOnSlot(world: World): void {
  const drones = world.query('Position', 'Movement');
  for (const droneId of drones) {
    const pos = world.getComponent(droneId, 'Position')!;
    const ref = getSlotRefAt(world, pos.x, pos.y);
    if (ref) {
      throw new Error(
        `Mission setup error: drone ${droneId} spawned on a work slot of entity ${ref.entityId} at (${pos.x}, ${pos.y}).`,
      );
    }
  }
}
