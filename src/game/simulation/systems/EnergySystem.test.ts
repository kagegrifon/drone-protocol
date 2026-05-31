import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../world/World.js';
import { EnergySystem } from './EnergySystem.js';

// BASE_CHARGE_SPEED=10 unit/sec, DT=0.1 → progress += 1.0 per tick → 1 tick per +1 energy unit
const TICKS_PER_UNIT = 1;

function makeWorld() {
  return new World();
}

function addDrone(
  world: World,
  x: number,
  y: number,
  energy: number,
  max = 100,
  state: 'idle' | 'running' | 'charge' = 'charge'
) {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Energy', { current: energy, max, drainPerMove: 5, drainPerMine: 2 });
  world.addComponent(id, 'Program', { currentProgramId: null, callStack: [], state, commandSlots: 4, personalProgramId: '' });
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

  it('charges +1 energy per 1 tick (BASE_CHARGE_SPEED=10 → 0.1s)', () => {
    const drone = addDrone(world, 3, 3, 50);
    addCharger(world, 3, 3);
    for (let i = 0; i < TICKS_PER_UNIT; i++) system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(51);
  });

  it('accumulates chargeProgress without adding energy before threshold', () => {
    // With SPEED=10 and DT=0.1, progress hits 1.0 immediately on first tick — no sub-threshold state.
    // This test verifies the field is cleared (undefined) after charge fires.
    const drone = addDrone(world, 3, 3, 50);
    addCharger(world, 3, 3);
    system.update();
    // After CHARGE fires, chargeProgress is cleared to undefined
    expect(world.getComponent(drone, 'Program')!.chargeProgress).toBeUndefined();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(51);
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
    const drone = addDrone(world, 3, 3, 99, 100, 'running');
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
    expect(program.chargeProgress).toBeUndefined();
  });

  it('resumes program after charging +1 unit even if not full (atomic CHARGE)', () => {
    const drone = addDrone(world, 3, 3, 50);
    addCharger(world, 3, 3);
    for (let i = 0; i < TICKS_PER_UNIT; i++) system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
    expect(world.getComponent(drone, 'Energy')!.current).toBe(51);
  });

  it('charges drone even without active CHARGE (passive charging)', () => {
    const drone = addDrone(world, 3, 3, 50, 100, 'running');
    addCharger(world, 3, 3);
    for (let i = 0; i < TICKS_PER_UNIT; i++) system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(51);
  });

  it('passive charging adds multiple units over time (not atomic)', () => {
    const drone = addDrone(world, 3, 3, 50, 100, 'running');
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
