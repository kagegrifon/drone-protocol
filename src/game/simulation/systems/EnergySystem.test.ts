import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../world/World.js';
import { EnergySystem } from './EnergySystem.js';

function makeWorld() {
  return new World();
}

function addDrone(
  world: World,
  x: number,
  y: number,
  energy: number,
  max = 100,
  waitingFor: 'charge' | undefined = 'charge'
) {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Energy', { current: energy, max, drainPerMove: 5, drainPerMine: 2 });
  world.addComponent(id, 'Program', { currentProgramId: null, callStack: [], state: 'waiting', commandSlots: 4, waitingFor, personalProgramId: '' });
  return id;
}

function addCharger(world: World, x: number, y: number, chargeRate = 10) {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'ChargerStation', { chargeRate });
  return id;
}

describe('EnergySystem', () => {
  let world: World;
  let system: EnergySystem;

  beforeEach(() => {
    world = makeWorld();
    system = new EnergySystem(world);
  });

  it('charges drone by chargeRate per tick when on charger', () => {
    const drone = addDrone(world, 3, 3, 50);
    addCharger(world, 3, 3, 10);
    system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(60);
  });

  it('does not exceed max energy', () => {
    const drone = addDrone(world, 3, 3, 95);
    addCharger(world, 3, 3, 10);
    system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(100);
  });

  it('does not charge drone not on charger', () => {
    const drone = addDrone(world, 3, 3, 50);
    addCharger(world, 5, 5, 10); // different position
    system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(50);
  });

  it('resumes program when energy is full and waitingFor=charge', () => {
    const drone = addDrone(world, 3, 3, 95);
    addCharger(world, 3, 3, 10);
    system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
    expect(program.waitingFor).toBeUndefined();
  });

  it('does not resume program if not yet full', () => {
    const drone = addDrone(world, 3, 3, 50);
    addCharger(world, 3, 3, 10);
    system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('waiting');
  });

  it('charges drone even when program is not waiting for charge (passive charging)', () => {
    const drone = addDrone(world, 3, 3, 50, 100, undefined);
    world.getComponent(drone, 'Program')!.state = 'running';
    world.getComponent(drone, 'Program')!.waitingFor = undefined;
    addCharger(world, 3, 3, 10);
    system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(60);
  });

  it('resumes program immediately when arriving at charger already full', () => {
    const drone = addDrone(world, 3, 3, 100);
    addCharger(world, 3, 3, 10);
    system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(100);
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
  });
});
