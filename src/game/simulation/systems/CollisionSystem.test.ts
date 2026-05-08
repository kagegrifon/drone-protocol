import { describe, it, expect } from 'vitest';
import { CollisionSystem } from './CollisionSystem.js';
import { World } from '../world/World.js';
import { createDrone } from '../entities/createDrone.js';

describe('CollisionSystem', () => {
  it('returns empty set when no drones exist', () => {
    const world = new World();
    const system = new CollisionSystem(world);
    system.update();
    expect(system.occupied.size).toBe(0);
  });

  it('snapshots integer position of a single drone', () => {
    const world = new World();
    const system = new CollisionSystem(world);
    createDrone(world, 3, 5);
    system.update();
    expect(system.occupied.has('3,5')).toBe(true);
    expect(system.occupied.size).toBe(1);
  });

  it('snapshots positions of multiple drones', () => {
    const world = new World();
    const system = new CollisionSystem(world);
    createDrone(world, 0, 0);
    createDrone(world, 4, 7);
    createDrone(world, 10, 10);
    system.update();
    expect(system.occupied.has('0,0')).toBe(true);
    expect(system.occupied.has('4,7')).toBe(true);
    expect(system.occupied.has('10,10')).toBe(true);
    expect(system.occupied.size).toBe(3);
  });

  it('updates snapshot after drone position changes', () => {
    const world = new World();
    const system = new CollisionSystem(world);
    const id = createDrone(world, 2, 2);
    system.update();
    expect(system.occupied.has('2,2')).toBe(true);

    // Перемещаем дрона
    const pos = world.getComponent(id, 'Position')!;
    pos.x = 5;
    pos.y = 5;
    system.update();
    expect(system.occupied.has('2,2')).toBe(false);
    expect(system.occupied.has('5,5')).toBe(true);
  });

  it('occupied is cleared and rebuilt on each update', () => {
    const world = new World();
    const system = new CollisionSystem(world);
    const id = createDrone(world, 1, 1);
    system.update();
    expect(system.occupied.size).toBe(1);

    world.destroyEntity(id);
    system.update();
    expect(system.occupied.size).toBe(0);
  });
});
