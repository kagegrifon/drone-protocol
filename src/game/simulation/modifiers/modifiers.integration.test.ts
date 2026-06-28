import { describe, it, expect } from 'vitest';
import { World } from '../world/World.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { ModifiersSystem } from '../systems/ModifiersSystem.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import type { EntityId } from '../../../shared/types/index.js';

// speed=1, DT=0.1 → progress += 0.1 * mul per tick, arrives when progress ≥ 1
// No modifiers (mul=1.0):        ceil(1/0.1)    = 10 ticks
// overloaded:heavy (mul=0.7):    ceil(1/0.07)   = 15 ticks

function setup() {
  const world = new World();
  const collision = new CollisionSystem(world);
  const modifiers = new ModifiersSystem(world);
  const movement = new MovementSystem(world);

  function tick() {
    collision.update();
    modifiers.update();
    movement.update();
  }

  function addMovingDrone(ore: number, capacity: number): EntityId {
    const id = world.createEntity();
    world.addComponent(id, 'Position', { x: 0, y: 0 });
    world.addComponent(id, 'Energy', { current: 100, max: 100, drainPerMove: 1, drainPerMine: 2 });
    world.addComponent(id, 'Inventory', { ore, capacity });
    world.addComponent(id, 'Movement', { targetX: 1, targetY: 0, path: [{ x: 1, y: 0 }], progress: 0, speed: 1 });
    world.addComponent(id, 'Program', { currentProgramId: null, callStack: [], state: 'move', commandSlots: 4, personalProgramId: '' });
    world.addComponent(id, 'Modifiers', { active: [] });
    return id;
  }

  return { world, tick, addMovingDrone };
}

describe('Модификаторы: замедление при загрузке инвентаря', () => {
  it('дрон без нагрузки проходит клетку за 10 тиков', () => {
    const { world, tick, addMovingDrone } = setup();
    const drone = addMovingDrone(0, 10);
    for (let i = 0; i < 9; i++) tick();
    expect(world.getComponent(drone, 'Position')!.x).toBe(0);
    tick();
    expect(world.getComponent(drone, 'Position')!.x).toBe(1);
  });

  it('дрон с 80% загрузкой (overloaded:heavy ×0.7) не прибывает за 14 тиков', () => {
    const { world, tick, addMovingDrone } = setup();
    const drone = addMovingDrone(8, 10);
    for (let i = 0; i < 14; i++) tick();
    expect(world.getComponent(drone, 'Position')!.x).toBe(0);
  });

  it('дрон с 80% загрузкой прибывает на 15-м тике', () => {
    const { world, tick, addMovingDrone } = setup();
    const drone = addMovingDrone(8, 10);
    for (let i = 0; i < 14; i++) tick();
    tick();
    expect(world.getComponent(drone, 'Position')!.x).toBe(1);
  });

  it('дрон с 50% загрузкой (overloaded:light ×0.9) прибывает не раньше 11-го тика', () => {
    // 0.9 × 0.1 = 0.09 → ceil(1/0.09) = 12 тиков
    const { world, tick, addMovingDrone } = setup();
    const drone = addMovingDrone(4, 10); // 40% → overloaded:light (>0.30)
    for (let i = 0; i < 11; i++) tick();
    expect(world.getComponent(drone, 'Position')!.x).toBe(0);
  });
});
