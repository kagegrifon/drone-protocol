import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../world/World.js';
import { EnergySystem } from './EnergySystem.js';

// BASE_CHARGE_DURATION_PER_UNIT=0.5s, DT=0.1 → 5 ticks per +1 energy unit
const TICKS_PER_UNIT = 5;

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

  it('charges +1 energy per 5 ticks (BASE_CHARGE_DURATION=0.5s)', () => {
    const drone = addDrone(world, 3, 3, 50);
    addCharger(world, 3, 3);
    for (let i = 0; i < TICKS_PER_UNIT; i++) system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(51);
  });

  it('does not charge before 5 ticks', () => {
    const drone = addDrone(world, 3, 3, 50);
    addCharger(world, 3, 3);
    for (let i = 0; i < TICKS_PER_UNIT - 1; i++) system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(50);
  });

  it('accumulates chargeElapsed without adding energy before threshold', () => {
    const drone = addDrone(world, 3, 3, 50);
    addCharger(world, 3, 3);
    for (let i = 0; i < 3; i++) system.update();
    expect(world.getComponent(drone, 'Program')!.chargeElapsed).toBeCloseTo(0.3);
    expect(world.getComponent(drone, 'Energy')!.current).toBe(50);
  });

  it('active CHARGE completes after +1 and passive charging continues (atomic CHARGE)', () => {
    const drone = addDrone(world, 3, 3, 50);
    addCharger(world, 3, 3);
    for (let i = 0; i < TICKS_PER_UNIT; i++) system.update();
    // CHARGE command fires once → +1, state back to running
    expect(world.getComponent(drone, 'Program')!.state).toBe('running');
    expect(world.getComponent(drone, 'Energy')!.current).toBe(51);
    // Further ticks: passive charging applies (station property)
    for (let i = 0; i < TICKS_PER_UNIT; i++) system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(52);
  });

  it('passive charging does not exceed max energy', () => {
    const drone = addDrone(world, 3, 3, 99, 100, undefined);
    world.getComponent(drone, 'Program')!.state = 'running';
    world.getComponent(drone, 'Program')!.waitingFor = undefined;
    addCharger(world, 3, 3);
    for (let i = 0; i < TICKS_PER_UNIT * 3; i++) system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(100);
  });

  it('does not charge drone not on charger', () => {
    const drone = addDrone(world, 3, 3, 50);
    addCharger(world, 5, 5); // different position
    for (let i = 0; i < TICKS_PER_UNIT; i++) system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(50);
  });

  it('resumes program when energy reaches max', () => {
    const drone = addDrone(world, 3, 3, 99);
    addCharger(world, 3, 3);
    for (let i = 0; i < TICKS_PER_UNIT; i++) system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
    expect(program.waitingFor).toBeUndefined();
    expect(program.chargeElapsed).toBeUndefined();
  });

  it('resumes program after charging +1 unit even if not full (atomic CHARGE)', () => {
    const drone = addDrone(world, 3, 3, 50);
    addCharger(world, 3, 3);
    for (let i = 0; i < TICKS_PER_UNIT; i++) system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
    expect(program.waitingFor).toBeUndefined();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(51);
  });

  it('charges drone even without waitingFor=charge (passive charging)', () => {
    const drone = addDrone(world, 3, 3, 50, 100, undefined);
    world.getComponent(drone, 'Program')!.state = 'running';
    world.getComponent(drone, 'Program')!.waitingFor = undefined;
    addCharger(world, 3, 3);
    for (let i = 0; i < TICKS_PER_UNIT; i++) system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(51);
  });

  it('passive charging adds multiple units over time (not atomic)', () => {
    const drone = addDrone(world, 3, 3, 50, 100, undefined);
    world.getComponent(drone, 'Program')!.state = 'running';
    world.getComponent(drone, 'Program')!.waitingFor = undefined;
    addCharger(world, 3, 3);
    for (let i = 0; i < TICKS_PER_UNIT * 3; i++) system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(53);
  });

  it('active CHARGE completes immediately when drone is not on a charger', () => {
    const drone = addDrone(world, 3, 3, 50);
    addCharger(world, 5, 5);
    system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
    expect(program.waitingFor).toBeUndefined();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(50);
  });

  it('resumes program immediately when already at max energy', () => {
    const drone = addDrone(world, 3, 3, 100);
    addCharger(world, 3, 3);
    system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(100);
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
  });
});
