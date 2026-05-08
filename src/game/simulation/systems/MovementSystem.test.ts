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
  world.addComponent(id, 'Program', { currentProgramId: null, callStack: [], state, commandSlots: 4, waitingFor });
  return id;
}

describe('MovementSystem', () => {
  let world: World;
  let system: MovementSystem;

  beforeEach(() => {
    world = makeWorld();
    system = new MovementSystem(world);
  });

  it('moves drone one cell along path on tick', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }, { x: 2, y: 0 }]);
    system.update();
    const pos = world.getComponent(id, 'Position')!;
    expect(pos.x).toBe(1);
    expect(pos.y).toBe(0);
  });

  it('drains energy per step entered', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }]);
    system.update();
    const energy = world.getComponent(id, 'Energy')!;
    expect(energy.current).toBe(95); // 100 - 5
  });

  it('advances multiple steps when speed > 1', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }, { x: 2, y: 0 }], 2);
    system.update();
    const pos = world.getComponent(id, 'Position')!;
    expect(pos.x).toBe(2);
    expect(pos.y).toBe(0);
  });

  it('drains energy for each step when multiple steps in one tick', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }, { x: 2, y: 0 }], 2);
    system.update();
    const energy = world.getComponent(id, 'Energy')!;
    expect(energy.current).toBe(90); // 100 - 5*2
  });

  it('resumes program on arrival (waitingFor=move)', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }]);
    system.update();
    const program = world.getComponent(id, 'Program')!;
    expect(program.state).toBe('running');
    expect(program.waitingFor).toBeUndefined();
  });

  it('does not resume program if waitingFor is not move', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 1, 100, 'waiting', 'mine');
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
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }], 1, 3); // energy=3, drainPerMove=5
    system.update();
    const energy = world.getComponent(id, 'Energy')!;
    expect(energy.current).toBe(0);
  });

  it('resets progress to 0 after arrival', () => {
    const id = addDrone(world, 0, 0, [{ x: 1, y: 0 }]);
    system.update();
    const movement = world.getComponent(id, 'Movement')!;
    expect(movement.progress).toBe(0);
    expect(movement.path.length).toBe(0);
  });
});
