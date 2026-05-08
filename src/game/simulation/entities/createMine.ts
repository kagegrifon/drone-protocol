import type { EntityId } from '../../../shared/types/index.js';
import type { World } from '../world/World.js';

export function createMine(world: World, x: number, y: number): EntityId {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Deposit', { oreRemaining: 200, mineRate: 1 });
  world.addComponent(id, 'Renderable', {
    spriteType: 'mine',
    visible: true,
    tint: 0xffffff,
  });
  return id;
}
