import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../world/World.js';
import { MiningSystem } from './MiningSystem.js';

// BASE_MINE_DURATION_PER_ORE=2.0s, DT=0.1 → 20 ticks per ore
// BASE_DROP_DURATION_PER_ORE=0.5s, DT=0.1 → 5 ticks per ore
const TICKS_PER_ORE_MINE = 20;
const TICKS_PER_ORE_DROP = 5;

function makeWorld() {
  return new World();
}

function addDrone(
  world: World,
  x: number,
  y: number,
  ore = 0,
  capacity = 10,
  waitingFor: 'mine' | 'drop' | undefined = 'mine'
) {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Energy', { current: 100, max: 100, drainPerMove: 5, drainPerMine: 2 });
  world.addComponent(id, 'Inventory', { ore, capacity });
  world.addComponent(id, 'Program', { currentProgramId: null, callStack: [], state: 'waiting', commandSlots: 4, waitingFor, personalProgramId: '' });
  return id;
}

function addDeposit(world: World, x: number, y: number, oreRemaining = 50, mineRate = 1) {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Deposit', { oreRemaining, mineRate });
  return id;
}

function addBase(world: World, x: number, y: number) {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Inventory', { ore: 0, capacity: 99999 });
  return id;
}

describe('MiningSystem — MINE', () => {
  let world: World;
  let system: MiningSystem;

  beforeEach(() => {
    world = makeWorld();
    system = new MiningSystem(world);
  });

  it('does not mine before 20 ticks (BASE_MINE_DURATION=2.0s)', () => {
    const drone = addDrone(world, 2, 3);
    addDeposit(world, 2, 3, 50, 1);
    for (let i = 0; i < TICKS_PER_ORE_MINE - 1; i++) system.update();
    expect(world.getComponent(drone, 'Inventory')!.ore).toBe(0);
  });

  it('mines 1 ore after 20 ticks', () => {
    const drone = addDrone(world, 2, 3);
    addDeposit(world, 2, 3, 50, 1);
    for (let i = 0; i < TICKS_PER_ORE_MINE; i++) system.update();
    expect(world.getComponent(drone, 'Inventory')!.ore).toBe(1);
    expect(world.getComponent(world.query('Position', 'Deposit')[0], 'Deposit')!.oreRemaining).toBe(49);
  });

  it('mines only 1 ore even after 40 ticks (atomic: command completes after first ore)', () => {
    const drone = addDrone(world, 2, 3);
    addDeposit(world, 2, 3, 50, 1);
    for (let i = 0; i < TICKS_PER_ORE_MINE * 2; i++) system.update();
    expect(world.getComponent(drone, 'Inventory')!.ore).toBe(1);
  });

  it('resumes program (running) immediately after mining one ore', () => {
    const drone = addDrone(world, 2, 3);
    addDeposit(world, 2, 3, 50, 1);
    for (let i = 0; i < TICKS_PER_ORE_MINE; i++) system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
    expect(program.waitingFor).toBeUndefined();
    expect(program.mineElapsed).toBeUndefined();
  });

  it('drains drainPerMine energy once per ore mined', () => {
    addDrone(world, 2, 3);
    addDeposit(world, 2, 3, 50, 1);
    const drone = world.query('Position', 'Inventory', 'Energy')[0];
    for (let i = 0; i < TICKS_PER_ORE_MINE; i++) system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(98); // 100 - 2
  });

  it('accumulates mineElapsed without mining before threshold', () => {
    const drone = addDrone(world, 2, 3);
    addDeposit(world, 2, 3, 50, 1);
    for (let i = 0; i < 5; i++) system.update();
    expect(world.getComponent(drone, 'Program')!.mineElapsed).toBeCloseTo(0.5);
    expect(world.getComponent(drone, 'Inventory')!.ore).toBe(0);
  });

  it('resumes program when inventory is full after mining', () => {
    const drone = addDrone(world, 2, 3, 9, 10); // 1 slot left
    addDeposit(world, 2, 3, 50, 1);
    for (let i = 0; i < TICKS_PER_ORE_MINE; i++) system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
    expect(program.waitingFor).toBeUndefined();
    expect(program.mineElapsed).toBeUndefined();
  });

  it('resumes program when deposit is exhausted', () => {
    const drone = addDrone(world, 2, 3, 0, 10);
    addDeposit(world, 2, 3, 1, 1); // 1 ore left
    for (let i = 0; i < TICKS_PER_ORE_MINE; i++) system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
    expect(program.mineElapsed).toBeUndefined();
  });

  it('resumes immediately if no deposit at drone position', () => {
    const drone = addDrone(world, 2, 3);
    system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
  });

  it('does not mine if drone not waiting for mine', () => {
    const drone = addDrone(world, 2, 3, 0, 10, undefined);
    world.getComponent(drone, 'Program')!.waitingFor = undefined;
    world.getComponent(drone, 'Program')!.state = 'running';
    const deposit = addDeposit(world, 2, 3, 50, 1);
    for (let i = 0; i < TICKS_PER_ORE_MINE; i++) system.update();
    expect(world.getComponent(deposit, 'Deposit')!.oreRemaining).toBe(50);
  });
});

describe('MiningSystem — DROP', () => {
  let world: World;
  let system: MiningSystem;

  beforeEach(() => {
    world = makeWorld();
    system = new MiningSystem(world);
  });

  it('does not transfer ore before 5 ticks (BASE_DROP_DURATION=0.5s)', () => {
    const drone = addDrone(world, 5, 5, 3, 10, 'drop');
    const base = addBase(world, 5, 5);
    for (let i = 0; i < TICKS_PER_ORE_DROP - 1; i++) system.update();
    expect(world.getComponent(drone, 'Inventory')!.ore).toBe(3);
    expect(world.getComponent(base, 'Inventory')!.ore).toBe(0);
  });

  it('transfers 1 ore after 5 ticks', () => {
    const drone = addDrone(world, 5, 5, 3, 10, 'drop');
    const base = addBase(world, 5, 5);
    for (let i = 0; i < TICKS_PER_ORE_DROP; i++) system.update();
    expect(world.getComponent(drone, 'Inventory')!.ore).toBe(2);
    expect(world.getComponent(base, 'Inventory')!.ore).toBe(1);
  });

  it('transfers only 1 ore per command even after 10 ticks (atomic)', () => {
    const drone = addDrone(world, 5, 5, 2, 10, 'drop');
    const base = addBase(world, 5, 5);
    for (let i = 0; i < TICKS_PER_ORE_DROP * 2; i++) system.update();
    expect(world.getComponent(drone, 'Inventory')!.ore).toBe(1);
    expect(world.getComponent(base, 'Inventory')!.ore).toBe(1);
  });

  it('resumes program when all ore dropped', () => {
    const drone = addDrone(world, 5, 5, 1, 10, 'drop');
    addBase(world, 5, 5);
    for (let i = 0; i < TICKS_PER_ORE_DROP; i++) system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
    expect(program.waitingFor).toBeUndefined();
    expect(program.dropElapsed).toBeUndefined();
  });

  it('resumes immediately if no base at position', () => {
    const drone = addDrone(world, 5, 5, 8, 10, 'drop');
    system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
  });
});
