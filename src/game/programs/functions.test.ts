import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../simulation/world/World.js';
import { FUNCTIONS, evaluateFunctionCall, resolveObjectRef } from './functions.js';

function makeDrone(world: World, x = 0, y = 0, opts: { energy?: number; energyMax?: number; ore?: number; capacity?: number } = {}) {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Energy', { current: opts.energy ?? 50, max: opts.energyMax ?? 100, drainPerMove: 1, drainPerMine: 2 });
  world.addComponent(id, 'Inventory', { ore: opts.ore ?? 3, capacity: opts.capacity ?? 10 });
  return id;
}

function makeMine(world: World, x: number, y: number, ore: number) {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Deposit', { oreRemaining: ore, mineRate: 1 });
  return id;
}

describe('resolveObjectRef', () => {
  it('Self → droneId', () => {
    expect(resolveObjectRef({ kind: 'self' }, 42)).toBe(42);
  });
  it('entity → entity.id', () => {
    expect(resolveObjectRef({ kind: 'entity', id: 7 }, 42)).toBe(7);
  });
});

describe('FUNCTIONS — Energy / EnergyMax', () => {
  let world: World;
  beforeEach(() => { world = new World(); });

  it('Energy returns current', () => {
    const drone = makeDrone(world, 0, 0, { energy: 73 });
    expect(FUNCTIONS.Energy.evaluate([drone], drone, world)).toBe(73);
  });
  it('EnergyMax returns max', () => {
    const drone = makeDrone(world, 0, 0, { energyMax: 120 });
    expect(FUNCTIONS.EnergyMax.evaluate([drone], drone, world)).toBe(120);
  });
  it('Energy returns null for object without Energy component', () => {
    const mine = makeMine(world, 1, 1, 5);
    expect(FUNCTIONS.Energy.evaluate([mine], mine, world)).toBeNull();
  });
});

describe('FUNCTIONS — Inventory / InventoryMax', () => {
  let world: World;
  beforeEach(() => { world = new World(); });

  it('Inventory returns ore', () => {
    const drone = makeDrone(world, 0, 0, { ore: 4 });
    expect(FUNCTIONS.Inventory.evaluate([drone], drone, world)).toBe(4);
  });
  it('InventoryMax returns capacity', () => {
    const drone = makeDrone(world, 0, 0, { capacity: 15 });
    expect(FUNCTIONS.InventoryMax.evaluate([drone], drone, world)).toBe(15);
  });
  it('Inventory returns null for object without Inventory', () => {
    const mine = makeMine(world, 1, 1, 5);
    expect(FUNCTIONS.Inventory.evaluate([mine], mine, world)).toBeNull();
  });
});

describe('FUNCTIONS — Deposit', () => {
  let world: World;
  beforeEach(() => { world = new World(); });

  it('Deposit returns oreRemaining', () => {
    const mine = makeMine(world, 5, 5, 12);
    expect(FUNCTIONS.Deposit.evaluate([mine], 999, world)).toBe(12);
  });
  it('Deposit returns null for object without Deposit', () => {
    const drone = makeDrone(world);
    expect(FUNCTIONS.Deposit.evaluate([drone], drone, world)).toBeNull();
  });
});

describe('FUNCTIONS — Distance', () => {
  let world: World;
  beforeEach(() => { world = new World(); });

  it('Distance is Manhattan', () => {
    const a = makeDrone(world, 1, 2);
    const b = makeMine(world, 4, 6, 1); // |4-1|+|6-2|=7
    expect(FUNCTIONS.Distance.evaluate([a, b], a, world)).toBe(7);
  });
  it('Distance(Self, X) — Self резолвится в droneId', () => {
    const drone = makeDrone(world, 0, 0);
    const mine = makeMine(world, 3, 0, 1);
    const result = evaluateFunctionCall(
      { fn: 'Distance', args: [{ kind: 'self' }, { kind: 'entity', id: mine }] },
      drone,
      world,
    );
    expect(result).toBe(3);
  });
  it('Distance returns null if any side lacks Position', () => {
    const drone = makeDrone(world);
    const ghost = world.createEntity(); // no Position
    expect(FUNCTIONS.Distance.evaluate([drone, ghost], drone, world)).toBeNull();
  });
});

describe('evaluateFunctionCall integrates Self resolution', () => {
  it('Energy(Self) reads drone energy', () => {
    const world = new World();
    const drone = makeDrone(world, 0, 0, { energy: 17 });
    expect(evaluateFunctionCall({ fn: 'Energy', args: [{ kind: 'self' }] }, drone, world)).toBe(17);
  });
});
