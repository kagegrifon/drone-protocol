import type { EntityId } from '../../../shared/types/index.js';
import type { World } from '../world/World.js';

export function createBase(world: World, x: number, y: number): EntityId {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Inventory', { ore: 0, capacity: 99999 });
  world.addComponent(id, 'Renderable', {
    spriteType: 'base',
    visible: true,
    tint: 0xffffff,
  });
  return id;
}
