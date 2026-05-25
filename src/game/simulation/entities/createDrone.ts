import type { EntityId } from '../../../shared/types/index.js';
import type { World } from '../world/World.js';
import { DEFAULT_DRONE_SPEED } from '../constants.js';

export function createDrone(world: World, x: number, y: number): EntityId {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Energy', {
    current: 100,
    max: 100,
    drainPerMove: 1,
    drainPerMine: 2,
  });
  world.addComponent(id, 'Inventory', { ore: 0, capacity: 10 });
  world.addComponent(id, 'Program', {
    currentProgramId: null,
    callStack: [],
    state: 'idle',
    commandSlots: 4,
    personalProgramId: '',
  });
  world.addComponent(id, 'Movement', {
    targetX: x,
    targetY: y,
    path: [],
    progress: 0,
    speed: DEFAULT_DRONE_SPEED,
  });
  world.addComponent(id, 'Renderable', {
    spriteType: 'drone',
    visible: true,
    tint: 0xffffff,
  });
  world.addComponent(id, 'Modifiers', { active: [] });
  return id;
}
