import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../world/World.js';
import { MiningSystem } from './MiningSystem.js';

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
  world.addComponent(id, 'Program', { currentProgramId: null, callStack: [], state: 'waiting', commandSlots: 4, waitingFor });
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

  it('transfers mineRate ore from deposit to drone inventory per tick', () => {
    const drone = addDrone(world, 2, 3);
    const deposit = addDeposit(world, 2, 3, 50, 1);
    system.update();
    expect(world.getComponent(drone, 'Inventory')!.ore).toBe(1);
    expect(world.getComponent(deposit, 'Deposit')!.oreRemaining).toBe(49);
  });

  it('drains drainPerMine energy per tick while mining', () => {
    addDrone(world, 2, 3);
    addDeposit(world, 2, 3);
    const drone = world.query('Position', 'Inventory', 'Energy')[0];
    system.update();
    expect(world.getComponent(drone, 'Energy')!.current).toBe(98); // 100 - 2
  });

  it('resumes program when inventory is full', () => {
    const drone = addDrone(world, 2, 3, 9, 10); // 1 slot left
    addDeposit(world, 2, 3, 50, 2); // mineRate=2 but only 1 slot
    system.update(); // fills up
    system.update(); // should resume
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
    expect(program.waitingFor).toBeUndefined();
  });

  it('resumes program when deposit is exhausted', () => {
    const drone = addDrone(world, 2, 3, 0, 10);
    addDeposit(world, 2, 3, 1, 1); // 1 ore left
    system.update(); // mines last ore
    system.update(); // deposit empty → resume
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
  });

  it('resumes immediately if no deposit at drone position', () => {
    const drone = addDrone(world, 2, 3);
    // no deposit entity at (2,3)
    system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
  });

  it('does not mine if drone not waiting for mine', () => {
    const drone = addDrone(world, 2, 3, 0, 10, undefined);
    world.getComponent(drone, 'Program')!.waitingFor = undefined;
    world.getComponent(drone, 'Program')!.state = 'running';
    const deposit = addDeposit(world, 2, 3, 50, 1);
    system.update();
    expect(world.getComponent(deposit, 'Deposit')!.oreRemaining).toBe(50);
  });

  it('mines at most capacity remaining per tick', () => {
    const drone = addDrone(world, 2, 3, 9, 10); // 1 slot left
    const deposit = addDeposit(world, 2, 3, 50, 5); // mineRate=5
    system.update();
    expect(world.getComponent(drone, 'Inventory')!.ore).toBe(10);
    expect(world.getComponent(deposit, 'Deposit')!.oreRemaining).toBe(49);
  });
});

describe('MiningSystem — DROP', () => {
  let world: World;
  let system: MiningSystem;

  beforeEach(() => {
    world = makeWorld();
    system = new MiningSystem(world);
  });

  it('transfers all ore from drone to base inventory instantly', () => {
    const drone = addDrone(world, 5, 5, 8, 10, 'drop');
    const base = addBase(world, 5, 5);
    system.update();
    expect(world.getComponent(drone, 'Inventory')!.ore).toBe(0);
    expect(world.getComponent(base, 'Inventory')!.ore).toBe(8);
  });

  it('resumes program immediately after drop', () => {
    const drone = addDrone(world, 5, 5, 8, 10, 'drop');
    addBase(world, 5, 5);
    system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
    expect(program.waitingFor).toBeUndefined();
  });

  it('resumes program even if no base at position', () => {
    const drone = addDrone(world, 5, 5, 8, 10, 'drop');
    // no base entity at (5,5)
    system.update();
    const program = world.getComponent(drone, 'Program')!;
    expect(program.state).toBe('running');
  });
});
