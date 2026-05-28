import type { EntityId } from '../../../shared/types/index.js';
import type { World } from './World.js';
import { gameEvents } from '../../../shared/events/gameEvents.js';

interface SlotRef {
  entityId: EntityId;
  slotIndex: number;
}

const worldIndex = new WeakMap<World, Map<string, SlotRef>>();

export function initWorkSlotsIndex(world: World): void {
  const index = new Map<string, SlotRef>();

  // Scan all existing entities with WorkSlots
  for (const entityId of world.query('WorkSlots')) {
    const ws = world.getComponent(entityId, 'WorkSlots')!;
    ws.slots.forEach((slot, i) => {
      index.set(`${slot.x},${slot.y}`, { entityId, slotIndex: i });
    });
  }

  worldIndex.set(world, index);

  gameEvents.on('drone:moved', ({ droneId, fromX, fromY, toX, toY }) => {
    const idx = worldIndex.get(world);
    if (!idx) return;

    const fromRef = idx.get(`${fromX},${fromY}`);
    if (fromRef) {
      const ws = world.getComponent(fromRef.entityId, 'WorkSlots');
      if (ws && ws.slots[fromRef.slotIndex].occupiedBy === droneId) {
        ws.slots[fromRef.slotIndex].occupiedBy = null;
      }
    }

    const toRef = idx.get(`${toX},${toY}`);
    if (toRef) {
      const ws = world.getComponent(toRef.entityId, 'WorkSlots');
      if (ws && ws.slots[toRef.slotIndex].occupiedBy === null) {
        ws.slots[toRef.slotIndex].occupiedBy = droneId;
      }
    }
  });

  gameEvents.on('entity:removed', ({ entityId, lastX, lastY }) => {
    const idx = worldIndex.get(world);
    if (!idx) return;

    // Clear occupancy if a drone was occupying a slot
    if (lastX !== undefined && lastY !== undefined) {
      const ref = idx.get(`${lastX},${lastY}`);
      if (ref) {
        const ws = world.getComponent(ref.entityId, 'WorkSlots');
        if (ws && ws.slots[ref.slotIndex].occupiedBy === entityId) {
          ws.slots[ref.slotIndex].occupiedBy = null;
        }
      }
    }

    // Remove slot index entries if the entity itself had WorkSlots
    // (entity still exists in world since event fires before component removal)
    const ws = world.getComponent(entityId, 'WorkSlots');
    if (ws) {
      ws.slots.forEach(slot => idx.delete(`${slot.x},${slot.y}`));
    }
  });
}

export function getSlotRefAt(
  world: World,
  x: number,
  y: number,
): { entityId: EntityId; slotIndex: number } | undefined {
  return worldIndex.get(world)?.get(`${x},${y}`);
}
