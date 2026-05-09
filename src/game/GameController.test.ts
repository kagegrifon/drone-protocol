import { describe, it, expect, vi } from 'vitest';

vi.mock('../renderer/GameRenderer.js', () => ({ GameRenderer: class {} }));

import { checkWin, checkFail } from './GameController.js';
import { World } from './simulation/world/World.js';
import type { StatsState } from '../shared/store/gameStore.js';

function makeStats(overrides: Partial<StatsState> = {}): StatsState {
  return {
    orePerMin: 10,
    congestion: 0,
    efficiency: 80,
    tick: 50,
    oreMined: 0,
    ...overrides,
  };
}

function makeBaseWorld(): { world: World; baseId: number } {
  const world = new World();
  const baseId = world.createEntity();
  world.addComponent(baseId, 'Inventory', { ore: 0, capacity: 99999 });
  return { world, baseId };
}

describe('checkWin – ore_mined', () => {
  it('returns false when base ore < target', () => {
    const { world, baseId } = makeBaseWorld();
    expect(checkWin({ type: 'ore_mined', target: 100 }, world, baseId, makeStats())).toBe(false);
  });

  it('returns true when base ore === target', () => {
    const { world, baseId } = makeBaseWorld();
    world.getComponent(baseId, 'Inventory')!.ore = 100;
    expect(checkWin({ type: 'ore_mined', target: 100 }, world, baseId, makeStats())).toBe(true);
  });

  it('returns true when base ore > target', () => {
    const { world, baseId } = makeBaseWorld();
    world.getComponent(baseId, 'Inventory')!.ore = 150;
    expect(checkWin({ type: 'ore_mined', target: 100 }, world, baseId, makeStats())).toBe(true);
  });
});

describe('checkWin – efficiency', () => {
  it('returns false when efficiency < target', () => {
    const { world, baseId } = makeBaseWorld();
    expect(checkWin({ type: 'efficiency', target: 90 }, world, baseId, makeStats({ efficiency: 70 }))).toBe(false);
  });

  it('returns true when efficiency >= target', () => {
    const { world, baseId } = makeBaseWorld();
    expect(checkWin({ type: 'efficiency', target: 80 }, world, baseId, makeStats({ efficiency: 80 }))).toBe(true);
  });
});

describe('checkFail – time_limit', () => {
  it('returns false when tick < maxTicks', () => {
    expect(checkFail({ type: 'time_limit', maxTicks: 600 }, makeStats({ tick: 599 }))).toBe(false);
  });

  it('returns true when tick >= maxTicks', () => {
    expect(checkFail({ type: 'time_limit', maxTicks: 600 }, makeStats({ tick: 600 }))).toBe(true);
  });
});

describe('checkFail – low_throughput', () => {
  it('returns false during grace period even if throughput is zero', () => {
    expect(checkFail(
      { type: 'low_throughput', minOrePerMin: 5, gracePeriodTicks: 60 },
      makeStats({ orePerMin: 0, tick: 59 }),
    )).toBe(false);
  });

  it('returns true after grace period when throughput below threshold', () => {
    expect(checkFail(
      { type: 'low_throughput', minOrePerMin: 5, gracePeriodTicks: 60 },
      makeStats({ orePerMin: 2, tick: 61 }),
    )).toBe(true);
  });

  it('returns false after grace period when throughput meets threshold', () => {
    expect(checkFail(
      { type: 'low_throughput', minOrePerMin: 5, gracePeriodTicks: 60 },
      makeStats({ orePerMin: 5, tick: 61 }),
    )).toBe(false);
  });
});
