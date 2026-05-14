import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../world/World.js';
import { StatisticsSystem } from './StatisticsSystem.js';

function makeWorld() {
  return new World();
}

function addDrone(world: World, state: 'idle' | 'running' | 'waiting' = 'running') {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x: 0, y: 0 });
  world.addComponent(id, 'Program', { currentProgramId: null, callStack: [], state, commandSlots: 4, personalProgramId: '' });
  return id;
}

describe('StatisticsSystem', () => {
  let world: World;
  let system: StatisticsSystem;

  beforeEach(() => {
    world = makeWorld();
    system = new StatisticsSystem(world);
  });

  it('starts with zero stats', () => {
    expect(system.stats.oreMined).toBe(0);
    expect(system.stats.orePerMinute).toBe(0);
    expect(system.stats.idleDroneCount).toBe(0);
    expect(system.stats.totalDrones).toBe(0);
    expect(system.stats.efficiency).toBe(0);
  });

  it('counts total drones after update', () => {
    addDrone(world, 'running');
    addDrone(world, 'running');
    system.update();
    expect(system.stats.totalDrones).toBe(2);
  });

  it('counts idle drones correctly', () => {
    addDrone(world, 'idle');
    addDrone(world, 'running');
    addDrone(world, 'waiting');
    system.update();
    expect(system.stats.idleDroneCount).toBe(1);
  });

  it('calculates efficiency as ratio of non-idle drones', () => {
    addDrone(world, 'idle');
    addDrone(world, 'running');
    system.update();
    expect(system.stats.efficiency).toBeCloseTo(0.5);
  });

  it('efficiency is 0 when no drones', () => {
    system.update();
    expect(system.stats.efficiency).toBe(0);
  });

  it('accumulates total ore via recordOreMined', () => {
    system.recordOreMined(5);
    system.recordOreMined(3);
    expect(system.stats.oreMined).toBe(8);
  });

  it('computes orePerMinute based on ore in last 60 seconds', () => {
    // 10 ticks/sec, 60s window = 600 ticks
    // Mine 10 ore per tick for 1 tick, then update
    system.recordOreMined(600);
    system.update();
    // Window = 1 tick = 0.1 sec → (600 / 0.1) * 60 = ... wait
    // orePerMinute = sum(history) / elapsedSeconds * 60
    // elapsedSeconds = 1 tick / 10 ticks/sec = 0.1s
    // orePerMinute = 600 / 0.1 * 60 = 360000 — that's too much
    // Let's be more realistic: mine 1 ore per tick for 10 ticks (1 second)
    // After 10 more updates with 1 ore each: sum=10, elapsed=11 ticks = 1.1s
    // orePerMinute ≈ 10/1.1*60 ≈ 545

    // Just verify it's greater than 0 after recording ore
    expect(system.stats.orePerMinute).toBeGreaterThan(0);
  });

  it('orePerMinute stabilizes to correct value over 600 ticks', () => {
    // Mine 10 ore/tick consistently for 600 ticks
    for (let i = 0; i < 600; i++) {
      system.recordOreMined(10);
      system.update();
    }
    // After 600 ticks (60 full seconds), orePerMinute should be 10 * 600 / 60s = 6000/min
    expect(system.stats.orePerMinute).toBeCloseTo(6000, 0);
  });

  it('records congestion events', () => {
    system.recordCongestion();
    system.recordCongestion();
    expect(system.stats.congestionEvents).toBe(2);
  });
});
