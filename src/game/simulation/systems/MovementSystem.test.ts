import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../world/World.js';
import { MovementSystem } from './MovementSystem.js';
import { gameEvents } from '../../../shared/events/gameEvents.js';

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

  it('moves drone exactly one cell after 10 ticks at speed=1, then stops', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }, { x: 2, y: 0 }], 1);
    for (let i = 0; i < 10; i++) system.update();
    const pos = world.getComponent(id, 'Position')!;
    expect(pos.x).toBe(1);
    expect(pos.y).toBe(0);
    // Дополнительные тики не сдвинут дрон — путь зачищен.
    for (let i = 0; i < 10; i++) system.update();
    const pos2 = world.getComponent(id, 'Position')!;
    expect(pos2.x).toBe(1);
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

  // speed=20: progress += 2.0 за тик → новая семантика: всё равно 1 шаг за команду
  it('advances exactly one cell per command even when speed=20', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }, { x: 2, y: 0 }], 20);
    system.update();
    const pos = world.getComponent(id, 'Position')!;
    expect(pos.x).toBe(1);
    expect(pos.y).toBe(0);
  });

  it('drains energy only once per atomic step even at speed=20', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }, { x: 2, y: 0 }], 20);
    system.update();
    const energy = world.getComponent(id, 'Energy')!;
    expect(energy.current).toBe(95); // 100 - 5*1 (атомарный шаг)
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

  it('clears the remaining path after one atomic step', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }], 10);
    system.update();
    const movement = world.getComponent(id, 'Movement')!;
    expect(movement.path).toEqual([]);
    expect(movement.progress).toBe(0);
  });
});

describe('MovementSystem — drone:moved эмиссия', () => {
  let world: World;
  let system: MovementSystem;

  beforeEach(() => {
    world = makeWorld();
    system = new MovementSystem(world);
    gameEvents.clearAll();
  });

  it('эмитит drone:moved с корректными координатами при успешном шаге', () => {
    const events: Array<{ droneId: number; fromX: number; fromY: number; toX: number; toY: number }> = [];
    gameEvents.on('drone:moved', e => events.push(e));

    const d = addDrone(world, 3, 5, [{ x: 4, y: 5 }], 10);
    system.update();

    expect(events).toEqual([{ droneId: d, fromX: 3, fromY: 5, toX: 4, toY: 5 }]);
  });

  it('не эмитит drone:moved если путь пуст', () => {
    const events: unknown[] = [];
    gameEvents.on('drone:moved', e => events.push(e));

    addDrone(world, 0, 0, []);
    system.update();

    expect(events).toHaveLength(0);
  });
});

describe('MovementSystem — фикс гонки (stepped-set)', () => {
  let world: World;
  let system: MovementSystem;

  beforeEach(() => {
    world = makeWorld();
    system = new MovementSystem(world);
    gameEvents.clearAll();
  });

  it('первый дрон шагает, второй с тем же целевым полем блокируется', () => {
    const blocked: number[] = [];
    gameEvents.on('drone:blocked', ({ droneId }) => blocked.push(droneId));

    const d1 = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10); // создан первым → победит
    const d2 = addDrone(world, 2, 0, [{ x: 1, y: 0 }], 10); // создан вторым → заблокирован

    system.update();

    expect(world.getComponent(d1, 'Position')).toMatchObject({ x: 1, y: 0 });
    expect(world.getComponent(d2, 'Position')).toMatchObject({ x: 2, y: 0 });
    expect(blocked).toEqual([d2]);
  });

  it('заблокированный дрон: путь очищен, программа resumeится', () => {
    addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10);
    const d2 = addDrone(world, 2, 0, [{ x: 1, y: 0 }], 10);

    system.update();

    const mov2 = world.getComponent(d2, 'Movement')!;
    const prog2 = world.getComponent(d2, 'Program')!;
    expect(mov2.path).toEqual([]);
    expect(mov2.progress).toBe(0);
    expect(prog2.state).toBe('running');
    expect(prog2.waitingFor).toBeUndefined();
  });

  it('два дрона движутся в разные клетки — оба проходят', () => {
    const blocked: number[] = [];
    gameEvents.on('drone:blocked', ({ droneId }) => blocked.push(droneId));

    const d1 = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 10);
    const d2 = addDrone(world, 0, 1, [{ x: 1, y: 1 }], 10);

    system.update();

    expect(world.getComponent(d1, 'Position')).toMatchObject({ x: 1, y: 0 });
    expect(world.getComponent(d2, 'Position')).toMatchObject({ x: 1, y: 1 });
    expect(blocked).toHaveLength(0);
  });

  it('дрон шагает в свою же клетку (path[0] === position) — шаг разрешён', () => {
    const d = addDrone(world, 1, 0, [{ x: 1, y: 0 }], 10); // цель = текущая позиция
    system.update();
    const mov = world.getComponent(d, 'Movement')!;
    expect(mov.path).toEqual([]);
  });
});
