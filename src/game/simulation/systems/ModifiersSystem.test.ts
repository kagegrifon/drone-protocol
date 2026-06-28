import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../world/World.js';
import { ModifiersSystem } from './ModifiersSystem.js';

function makeWorld() { return new World(); }

function addDrone(
  world: World,
  energy: number,
  maxEnergy: number,
  ore: number,
  capacity: number,
  initialModifiers: string[] = []
) {
  const id = world.createEntity();
  world.addComponent(id, 'Energy', { current: energy, max: maxEnergy, drainPerMove: 1, drainPerMine: 2 });
  world.addComponent(id, 'Inventory', { ore, capacity });
  world.addComponent(id, 'Modifiers', { active: initialModifiers as any });
  return id;
}

describe('ModifiersSystem', () => {
  let world: World;
  let system: ModifiersSystem;

  beforeEach(() => {
    world = makeWorld();
    system = new ModifiersSystem(world);
  });

  describe('inventory overload thresholds (capacity=10)', () => {
    it('ore=0 → no modifiers', () => {
      const id = addDrone(world, 100, 100, 0, 10);
      system.update();
      expect(world.getComponent(id, 'Modifiers')!.active).toEqual([]);
    });

    it('ore=3 (30%) → no overload (boundary: NOT above 0.30)', () => {
      const id = addDrone(world, 100, 100, 3, 10);
      system.update();
      expect(world.getComponent(id, 'Modifiers')!.active).toEqual([]);
    });

    it('ore=4 (40%) → overloaded:light (above 0.30)', () => {
      const id = addDrone(world, 100, 100, 4, 10);
      system.update();
      expect(world.getComponent(id, 'Modifiers')!.active).toEqual(['overloaded:light']);
    });

    it('ore=5 (50%) → overloaded:light (boundary: NOT above 0.50)', () => {
      const id = addDrone(world, 100, 100, 5, 10);
      system.update();
      expect(world.getComponent(id, 'Modifiers')!.active).toEqual(['overloaded:light']);
    });

    it('ore=6 (60%) → overloaded:medium (above 0.50)', () => {
      const id = addDrone(world, 100, 100, 6, 10);
      system.update();
      expect(world.getComponent(id, 'Modifiers')!.active).toEqual(['overloaded:medium']);
    });

    it('ore=7 (70%) → overloaded:medium (boundary: NOT above 0.70)', () => {
      const id = addDrone(world, 100, 100, 7, 10);
      system.update();
      expect(world.getComponent(id, 'Modifiers')!.active).toEqual(['overloaded:medium']);
    });

    it('ore=8 (80%) → overloaded:heavy (above 0.70)', () => {
      const id = addDrone(world, 100, 100, 8, 10);
      system.update();
      expect(world.getComponent(id, 'Modifiers')!.active).toEqual(['overloaded:heavy']);
    });

    it('ore=10 (100%) → overloaded:heavy', () => {
      const id = addDrone(world, 100, 100, 10, 10);
      system.update();
      expect(world.getComponent(id, 'Modifiers')!.active).toEqual(['overloaded:heavy']);
    });
  });

  describe('drained activation', () => {
    it('energy=0 → drained', () => {
      const id = addDrone(world, 0, 100, 0, 10);
      system.update();
      expect(world.getComponent(id, 'Modifiers')!.active).toContain('drained');
    });

    it('energy=1 max=100 (1%) — previously drained stays drained', () => {
      const id = addDrone(world, 1, 100, 0, 10, ['drained']);
      system.update();
      expect(world.getComponent(id, 'Modifiers')!.active).toContain('drained');
    });

    it('energy=1 max=100 (1%) — fresh drone stays []', () => {
      const id = addDrone(world, 1, 100, 0, 10);
      system.update();
      expect(world.getComponent(id, 'Modifiers')!.active).not.toContain('drained');
    });
  });

  describe('drained hysteresis', () => {
    it('previously drained + energy=1 (max=100) → stays drained', () => {
      const id = addDrone(world, 1, 100, 0, 10, ['drained']);
      system.update();
      expect(world.getComponent(id, 'Modifiers')!.active).toContain('drained');
    });

    it('previously drained + energy=4 (max=100, 4% < 5%) → stays drained', () => {
      const id = addDrone(world, 4, 100, 0, 10, ['drained']);
      system.update();
      expect(world.getComponent(id, 'Modifiers')!.active).toContain('drained');
    });

    it('previously drained + energy=5 (max=100, 5% = threshold) → snapped off', () => {
      const id = addDrone(world, 5, 100, 0, 10, ['drained']);
      system.update();
      expect(world.getComponent(id, 'Modifiers')!.active).not.toContain('drained');
    });

    it('fresh drone + energy=3 (max=100) → [] (never was drained)', () => {
      const id = addDrone(world, 3, 100, 0, 10);
      system.update();
      expect(world.getComponent(id, 'Modifiers')!.active).toEqual([]);
    });
  });

  describe('combined modifiers', () => {
    it('energy=0, ore=8, capacity=10 → both drained AND overloaded:heavy', () => {
      const id = addDrone(world, 0, 100, 8, 10);
      system.update();
      const active = world.getComponent(id, 'Modifiers')!.active;
      expect(active).toContain('drained');
      expect(active).toContain('overloaded:heavy');
    });
  });
});
