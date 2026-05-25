import { describe, it, expect } from 'vitest';
import { World } from './world/World.js';
import { Grid } from './world/Grid.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { ProgramExecutionSystem } from './systems/ProgramExecutionSystem.js';
import { MiningSystem } from './systems/MiningSystem.js';
import { BASE_MINE_DURATION_PER_ORE, DT } from './constants.js';
import type { ProgramRegistry } from '../programs/types.js';

const TICKS_PER_ORE = Math.round(BASE_MINE_DURATION_PER_ORE / DT); // 20

function setup() {
  const world = new World();
  const grid = new Grid();
  const collision = new CollisionSystem(world);
  const registry: ProgramRegistry = new Map([
    ['loop-mine', {
      id: 'loop-mine',
      name: 'Loop Mine',
      instructions: [{ type: 'LOOP', body: [{ type: 'MINE' }] }] as never,
    }],
  ]);
  const exec = new ProgramExecutionSystem(world, grid, collision, registry);
  const mining = new MiningSystem(world);

  const drone = world.createEntity();
  world.addComponent(drone, 'Position', { x: 0, y: 0 });
  world.addComponent(drone, 'Energy', { current: 100, max: 100, drainPerMove: 5, drainPerMine: 2 });
  world.addComponent(drone, 'Inventory', { ore: 0, capacity: 10 });
  world.addComponent(drone, 'Movement', { targetX: 0, targetY: 0, path: [], progress: 0, speed: 1 });
  world.addComponent(drone, 'Program', {
    currentProgramId: 'loop-mine',
    callStack: [{ programId: 'loop-mine', instructionIndex: 0 }],
    state: 'running',
    commandSlots: 4,
    personalProgramId: '',
  });

  const deposit = world.createEntity();
  world.addComponent(deposit, 'Position', { x: 0, y: 0 });
  world.addComponent(deposit, 'Deposit', { oreRemaining: 10, mineRate: 1 });

  function tick() {
    collision.update();
    exec.update();
    mining.update();
  }

  return { world, drone, deposit, tick };
}

describe('atomic actions integration: LOOP { MINE }', () => {
  it('mines exactly one ore per BASE_MINE_DURATION_PER_ORE window (not all at once)', () => {
    const { world, drone, tick } = setup();

    // Один цикл LOOP { MINE }: 1 тик на push LOOP-кадра + 1 тик на выдачу MINE + 19 тиков
    // накопления mineElapsed → +1 руда на 21-м тике. На следующей итерации цикл
    // делает то же самое: reset кадра (1 тик) + MINE (1 тик) + 19 накопления = 21 тик.
    const oreAtSnapshots: number[] = [];
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < TICKS_PER_ORE + 1; i++) tick();
      oreAtSnapshots.push(world.getComponent(drone, 'Inventory')!.ore);
    }

    expect(oreAtSnapshots).toEqual([1, 2, 3]);
  });

  it('does not mine more than one ore within a single BASE_MINE_DURATION window', () => {
    const { world, drone, tick } = setup();

    for (let i = 0; i < TICKS_PER_ORE + 1; i++) tick();
    expect(world.getComponent(drone, 'Inventory')!.ore).toBe(1);

    // Пол-окна спустя руды по-прежнему 1 — атомарный MINE не успел сработать дважды.
    for (let i = 0; i < Math.floor(TICKS_PER_ORE / 2); i++) tick();
    expect(world.getComponent(drone, 'Inventory')!.ore).toBe(1);
  });
});
