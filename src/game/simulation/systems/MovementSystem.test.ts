import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../world/World.js';
import { MovementSystem } from './MovementSystem.js';

function makeWorld() {
  return new World();
}

function addDrone(
  world: World,
  x: number,
  y: number,
  pathTo: { x: number; y: number }[],
  speed = 1,
  energy = 100,
  state: 'idle' | 'running' | 'waiting' = 'waiting',
  waitingFor: 'move' | 'mine' | 'drop' | 'charge' | undefined = 'move'
) {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  world.addComponent(id, 'Energy', { current: energy, max: 100, drainPerMove: 5, drainPerMine: 2 });
  const last = pathTo[pathTo.length - 1];
  world.addComponent(id, 'Movement', { targetX: last?.x ?? x, targetY: last?.y ?? y, path: [...pathTo], progress: 0, speed });
  world.addComponent(id, 'Program', { currentProgramId: null, callStack: [], state, commandSlots: 4, waitingFor, personalProgramId: '' });
  return id;
}

describe('MovementSystem', () => {
  let world: World;
  let system: MovementSystem;

  beforeEach(() => {
    world = makeWorld();
    system = new MovementSystem(world);
  });

  // speed=1 (клеток/сек): progress += DT*1 = 0.1 за тик → 10 тиков = 1 шаг
  it('accumulates progress but does not move in 1 tick at speed=1', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 1);
    system.update();
    const pos = world.getComponent(id, 'Position')!;
    expect(pos.x).toBe(0); // не сдвинулся
    const movement = world.getComponent(id, 'Movement')!;
    expect(movement.progress).toBeCloseTo(0.1);
  });

  it('moves drone one cell after 10 ticks at speed=1', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }, { x: 2, y: 0 }], 1);
    for (let i = 0; i < 10; i++) system.update();
    const pos = world.getComponent(id, 'Position')!;
    expect(pos.x).toBe(1);
    expect(pos.y).toBe(0);
  });

  // speed=10 (клеток/сек): progress += DT*10 = 1.0 за тик → 1 тик = 1 шаг
  it('moves drone one cell per tick at speed=10', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }, { x: 2, y: 0 }], 10);
    system.update();
    const pos = world.getComponent(id, 'Position')!;
    expect(pos.x).toBe(1);
    expect(pos.y).toBe(0);
  });

  it('drains energy per step entered', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10);
    system.update();
    const energy = world.getComponent(id, 'Energy')!;
    expect(energy.current).toBe(95); // 100 - 5
  });

  // speed=20: progress += 2.0 за тик → 2 шага за тик
  it('advances multiple steps when speed=20 (2 cells/tick)', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }, { x: 2, y: 0 }], 20);
    system.update();
    const pos = world.getComponent(id, 'Position')!;
    expect(pos.x).toBe(2);
    expect(pos.y).toBe(0);
  });

  it('drains energy for each step when multiple steps in one tick', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }, { x: 2, y: 0 }], 20);
    system.update();
    const energy = world.getComponent(id, 'Energy')!;
    expect(energy.current).toBe(90); // 100 - 5*2
  });

  it('resumes program on arrival (waitingFor=move)', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10);
    system.update();
    const program = world.getComponent(id, 'Program')!;
    expect(program.state).toBe('running');
    expect(program.waitingFor).toBeUndefined();
  });

  it('does not resume program if waitingFor is not move', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10, 100, 'waiting', 'mine');
    system.update();
    const program = world.getComponent(id, 'Program')!;
    expect(program.state).toBe('waiting');
    expect(program.waitingFor).toBe('mine');
  });

  it('does not move drone with empty path', () => {
    const id = addDrone(world, 3, 3, []);
    system.update();
    const pos = world.getComponent(id, 'Position')!;
    expect(pos.x).toBe(3);
    expect(pos.y).toBe(3);
  });

  it('clamps energy to 0 when drain exceeds current energy', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10, 3); // energy=3, drainPerMove=5
    system.update();
    const energy = world.getComponent(id, 'Energy')!;
    expect(energy.current).toBe(0);
  });

  it('resets progress to 0 after arrival', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10);
    system.update();
    const movement = world.getComponent(id, 'Movement')!;
    expect(movement.progress).toBe(0);
    expect(movement.path.length).toBe(0);
  });
});
