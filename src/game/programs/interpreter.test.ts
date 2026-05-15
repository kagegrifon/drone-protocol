import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../simulation/world/World.js';
import { Grid } from '../simulation/world/Grid.js';
import { stepProgram } from './interpreter.js';
import type { ProgramRegistry, Instruction } from './types.js';

const EMPTY_GRID = new Grid();
const EMPTY_OCCUPIED = new Set<string>();

function makeWorld() {
  return new World();
}

function addTarget(world: World, x: number, y: number): number {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x, y });
  return id;
}

function addDrone(
  world: World,
  state: 'idle' | 'running' | 'waiting' = 'running',
  instructions: Instruction[] = [],
  opts: { ore?: number; capacity?: number; energy?: number; energyMax?: number } = {}
) {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { x: 0, y: 0 });
  world.addComponent(id, 'Energy', {
    current: opts.energy ?? 100,
    max: opts.energyMax ?? 100,
    drainPerMove: 5,
    drainPerMine: 2,
  });
  world.addComponent(id, 'Inventory', { ore: opts.ore ?? 0, capacity: opts.capacity ?? 10 });
  world.addComponent(id, 'Movement', { targetX: 0, targetY: 0, path: [], progress: 0, speed: 1 });

  const programId = 'prog_main';
  const registry: ProgramRegistry = new Map([
    [programId, { id: programId, name: 'Main', instructions }],
  ]);
  world.addComponent(id, 'Program', {
    currentProgramId: programId,
    callStack: state === 'running' ? [{ programId, instructionIndex: 0 }] : [],
    state,
    commandSlots: 4,
    personalProgramId: '',
  });

  return { id, registry };
}

// ─── Базовые action-блоки ───────────────────────────────────────────────────

describe('stepProgram — MINE', () => {
  let world: World;

  beforeEach(() => { world = makeWorld(); });

  it('sets state=waiting and waitingFor=mine', () => {
    const { id, registry } = addDrone(world, 'running', [{ type: 'MINE' }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.state).toBe('waiting');
    expect(prog.waitingFor).toBe('mine');
  });

  it('advances instructionIndex after MINE', () => {
    const { id, registry } = addDrone(world, 'running', [{ type: 'MINE' }, { type: 'DROP' }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.callStack[0].instructionIndex).toBe(1);
  });
});

describe('stepProgram — DROP', () => {
  let world: World;

  beforeEach(() => { world = makeWorld(); });

  it('sets state=waiting and waitingFor=drop', () => {
    const { id, registry } = addDrone(world, 'running', [{ type: 'DROP' }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.state).toBe('waiting');
    expect(prog.waitingFor).toBe('drop');
  });
});

describe('stepProgram — CHARGE', () => {
  let world: World;

  beforeEach(() => { world = makeWorld(); });

  it('sets state=waiting and waitingFor=charge', () => {
    const { id, registry } = addDrone(world, 'running', [{ type: 'CHARGE' }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.state).toBe('waiting');
    expect(prog.waitingFor).toBe('charge');
  });
});

// ─── WAIT ──────────────────────────────────────────────────────────────────

describe('stepProgram — WAIT', () => {
  let world: World;

  beforeEach(() => { world = makeWorld(); });

  it('sets waitRemaining and advances instructionIndex on first call', () => {
    const { id, registry } = addDrone(world, 'running', [{ type: 'WAIT', ticks: 3 }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.callStack[0].waitRemaining).toBe(3);
    expect(prog.callStack[0].instructionIndex).toBe(1);
    expect(prog.state).toBe('running');
  });

  it('decrements waitRemaining on each tick', () => {
    const { id, registry } = addDrone(world, 'running', [{ type: 'WAIT', ticks: 3 }, { type: 'DROP' }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // sets waitRemaining=3
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // 3→2
    expect(world.getComponent(id, 'Program')!.callStack[0].waitRemaining).toBe(2);
  });

  it('proceeds to next instruction after wait expires', () => {
    const { id, registry } = addDrone(world, 'running', [{ type: 'WAIT', ticks: 2 }, { type: 'DROP' }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // sets waitRemaining=2
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // 2→1
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // 1→0
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // 0 → execute DROP
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.state).toBe('waiting');
    expect(prog.waitingFor).toBe('drop');
  });
});

// ─── Пустой callStack ──────────────────────────────────────────────────────

describe('stepProgram — idle transitions', () => {
  let world: World;

  beforeEach(() => { world = makeWorld(); });

  it('sets state=idle when callStack is empty', () => {
    const { id, registry } = addDrone(world, 'running', []);
    // callStack has one frame with index 0, program is empty → frame finishes immediately
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.state).toBe('idle');
  });

  it('does nothing if state is not running', () => {
    const { id, registry } = addDrone(world, 'waiting', [{ type: 'MINE' }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.state).toBe('waiting');
    expect(prog.callStack.length).toBe(0);
  });

  it('program finishes after all instructions executed', () => {
    const { id, registry } = addDrone(world, 'running', [{ type: 'MINE' }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // MINE → waiting
    // Resume manually
    const prog = world.getComponent(id, 'Program')!;
    prog.state = 'running';
    prog.waitingFor = undefined;
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // index now past end → idle
    expect(world.getComponent(id, 'Program')!.state).toBe('idle');
  });
});

// ─── LOOP ─────────────────────────────────────────────────────────────────

describe('stepProgram — LOOP', () => {
  let world: World;

  beforeEach(() => { world = makeWorld(); });

  it('pushes an inline sub-frame when entering LOOP', () => {
    const { id, registry } = addDrone(world, 'running', [
      { type: 'LOOP', body: [{ type: 'MINE' }] },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.callStack.length).toBe(2);
    expect(prog.callStack[1].isLoop).toBe(true);
  });

  it('executes MINE inside LOOP body', () => {
    const { id, registry } = addDrone(world, 'running', [
      { type: 'LOOP', body: [{ type: 'MINE' }] },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // enter loop
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // execute MINE
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.state).toBe('waiting');
    expect(prog.waitingFor).toBe('mine');
  });

  it('restarts loop body after body completes', () => {
    const { id, registry } = addDrone(world, 'running', [
      { type: 'LOOP', body: [{ type: 'MINE' }] },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // enter loop
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // MINE → waiting

    // Resume
    const prog = world.getComponent(id, 'Program')!;
    prog.state = 'running';
    prog.waitingFor = undefined;

    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // index past end → restart (isLoop)
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // MINE again → waiting
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('mine');
  });
});

// ─── REPEAT ───────────────────────────────────────────────────────────────

describe('stepProgram — REPEAT', () => {
  let world: World;

  beforeEach(() => { world = makeWorld(); });

  it('pushes a sub-frame with repeatRemaining = count-1', () => {
    const { id, registry } = addDrone(world, 'running', [
      { type: 'REPEAT', count: 3, body: [{ type: 'DROP' }] },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    const frame = world.getComponent(id, 'Program')!.callStack[1];
    expect(frame.repeatRemaining).toBe(2);
  });

  it('runs body exactly count times then pops frame', () => {
    const { id, registry } = addDrone(world, 'running', [
      { type: 'REPEAT', count: 2, body: [{ type: 'DROP' }] },
      { type: 'CHARGE' },
    ]);

    let dropCount = 0;

    function runUntilCharge(maxSteps = 20) {
      for (let i = 0; i < maxSteps; i++) {
        const prog = world.getComponent(id, 'Program')!;
        if (prog.state === 'waiting' && prog.waitingFor === 'charge') return;
        if (prog.state === 'waiting' && prog.waitingFor === 'drop') {
          dropCount++;
          prog.state = 'running';
          prog.waitingFor = undefined;
          continue;
        }
        stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
      }
    }

    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // enter REPEAT
    runUntilCharge();

    expect(dropCount).toBe(2);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('charge');
  });
});

// ─── RUN_PROGRAM ──────────────────────────────────────────────────────────

describe('stepProgram — RUN_PROGRAM', () => {
  let world: World;

  beforeEach(() => { world = makeWorld(); });

  it('pushes a new frame for the called program', () => {
    const subId = 'sub';
    const registry: ProgramRegistry = new Map([
      ['main', { id: 'main', name: 'Main', instructions: [{ type: 'RUN_PROGRAM', programId: subId }] }],
      [subId, { id: subId, name: 'Sub', instructions: [{ type: 'MINE' }] }],
    ]);
    const id = world.createEntity();
    world.addComponent(id, 'Position', { x: 0, y: 0 });
    world.addComponent(id, 'Energy', { current: 100, max: 100, drainPerMove: 5, drainPerMine: 2 });
    world.addComponent(id, 'Inventory', { ore: 0, capacity: 10 });
    world.addComponent(id, 'Movement', { targetX: 0, targetY: 0, path: [], progress: 0, speed: 1 });
    world.addComponent(id, 'Program', {
      currentProgramId: 'main',
      callStack: [{ programId: 'main', instructionIndex: 0 }],
      state: 'running',
      commandSlots: 4,
      personalProgramId: '',
    });

    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // enter sub
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.callStack.length).toBe(2);
    expect(prog.callStack[1].programId).toBe(subId);
  });

  it('returns to parent after sub-program finishes', () => {
    const subId = 'sub';
    const registry: ProgramRegistry = new Map([
      ['main', { id: 'main', name: 'Main', instructions: [{ type: 'RUN_PROGRAM', programId: subId }, { type: 'CHARGE' }] }],
      [subId, { id: subId, name: 'Sub', instructions: [{ type: 'DROP' }] }],
    ]);
    const id = world.createEntity();
    world.addComponent(id, 'Position', { x: 0, y: 0 });
    world.addComponent(id, 'Energy', { current: 100, max: 100, drainPerMove: 5, drainPerMine: 2 });
    world.addComponent(id, 'Inventory', { ore: 0, capacity: 10 });
    world.addComponent(id, 'Movement', { targetX: 0, targetY: 0, path: [], progress: 0, speed: 1 });
    world.addComponent(id, 'Program', {
      currentProgramId: 'main',
      callStack: [{ programId: 'main', instructionIndex: 0 }],
      state: 'running',
      commandSlots: 4,
      personalProgramId: '',
    });

    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // call sub
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // DROP → waiting
    const prog = world.getComponent(id, 'Program')!;
    prog.state = 'running';
    prog.waitingFor = undefined;
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // sub end → pop → back to main at CHARGE
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // CHARGE → waiting
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('charge');
  });
});

// ─── IF ──────────────────────────────────────────────────────────────────

describe('stepProgram — IF conditions', () => {
  let world: World;

  beforeEach(() => { world = makeWorld(); });

  // ── ENERGY ─────────────────────────────────────────────────────────────

  it('ENERGY % < 30 is true when energy=20, max=100', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{ property: { kind: 'ENERGY', unit: '%' }, operator: '<', value: 30 }],
        operators: [],
        then: [{ type: 'CHARGE' }],
      },
    ], { energy: 20, energyMax: 100 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('charge');
  });

  it('ENERGY % < 30 is false when energy=80, max=100', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{ property: { kind: 'ENERGY', unit: '%' }, operator: '<', value: 30 }],
        operators: [],
        then: [{ type: 'CHARGE' }],
      },
      { type: 'DROP' },
    ], { energy: 80, energyMax: 100 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // IF false → skip
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // DROP
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('drop');
  });

  it('ENERGY abs >= 50 is true when energy=50', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{ property: { kind: 'ENERGY', unit: 'abs' }, operator: '>=', value: 50 }],
        operators: [],
        then: [{ type: 'MINE' }],
      },
    ], { energy: 50, energyMax: 100 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('mine');
  });

  // ── INVENTORY ───────────────────────────────────────────────────────────

  it('INVENTORY % = 100 is true when ore=10, capacity=10', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{ property: { kind: 'INVENTORY', unit: '%' }, operator: '=', value: 100 }],
        operators: [],
        then: [{ type: 'DROP' }],
      },
    ], { ore: 10, capacity: 10 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('drop');
  });

  it('INVENTORY abs >= 5 is false when ore=3', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{ property: { kind: 'INVENTORY', unit: 'abs' }, operator: '>=', value: 5 }],
        operators: [],
        then: [{ type: 'DROP' }],
      },
      { type: 'MINE' },
    ], { ore: 3, capacity: 10 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('mine');
  });

  // ── DEPOSIT ─────────────────────────────────────────────────────────────

  it('DEPOSIT = 0 is true when deposit at drone position is empty', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{ property: { kind: 'DEPOSIT' }, operator: '=', value: 0 }],
        operators: [],
        then: [{ type: 'DROP' }],
      },
    ]);
    // Add a depleted deposit at drone position (0,0)
    const depId = world.createEntity();
    world.addComponent(depId, 'Position', { x: 0, y: 0 });
    world.addComponent(depId, 'Deposit', { oreRemaining: 0, mineRate: 1 });

    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('drop');
  });

  it('DEPOSIT = 0 is false when deposit has ore remaining', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{ property: { kind: 'DEPOSIT' }, operator: '=', value: 0 }],
        operators: [],
        then: [{ type: 'DROP' }],
      },
      { type: 'MINE' },
    ]);
    const depId = world.createEntity();
    world.addComponent(depId, 'Position', { x: 0, y: 0 });
    world.addComponent(depId, 'Deposit', { oreRemaining: 5, mineRate: 1 });

    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('mine');
  });

  // ── DISTANCE ────────────────────────────────────────────────────────────

  it('DISTANCE <= 3 is true when target is 2 cells away (Manhattan)', () => {
    const targetId = addTarget(world, 2, 0);
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{ property: { kind: 'DISTANCE', targetEntityId: targetId }, operator: '<=', value: 3 }],
        operators: [],
        then: [{ type: 'MINE' }],
      },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('mine');
  });

  it('DISTANCE <= 3 is false when target is 5 cells away', () => {
    const targetId = addTarget(world, 5, 0);
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{ property: { kind: 'DISTANCE', targetEntityId: targetId }, operator: '<=', value: 3 }],
        operators: [],
        then: [{ type: 'MINE' }],
      },
      { type: 'DROP' },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('drop');
  });

  // ── AND / OR ────────────────────────────────────────────────────────────

  it('AND: true when both conditions met', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [
          { property: { kind: 'ENERGY', unit: '%' }, operator: '<', value: 50 },
          { property: { kind: 'INVENTORY', unit: '%' }, operator: '=', value: 100 },
        ],
        operators: ['AND'],
        then: [{ type: 'CHARGE' }],
      },
    ], { energy: 20, energyMax: 100, ore: 10, capacity: 10 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('charge');
  });

  it('AND: false when only one condition met', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [
          { property: { kind: 'ENERGY', unit: '%' }, operator: '<', value: 50 },
          { property: { kind: 'INVENTORY', unit: '%' }, operator: '=', value: 100 },
        ],
        operators: ['AND'],
        then: [{ type: 'CHARGE' }],
      },
      { type: 'DROP' },
    ], { energy: 20, energyMax: 100, ore: 3, capacity: 10 }); // inventory not full
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('drop');
  });

  it('OR: true when only second condition met', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [
          { property: { kind: 'ENERGY', unit: '%' }, operator: '<', value: 10 }, // false
          { property: { kind: 'INVENTORY', unit: '%' }, operator: '=', value: 100 }, // true
        ],
        operators: ['OR'],
        then: [{ type: 'DROP' }],
      },
    ], { energy: 80, energyMax: 100, ore: 10, capacity: 10 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('drop');
  });

  it('empty conditions list evaluates to false', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [],
        operators: [],
        then: [{ type: 'DROP' }],
      },
      { type: 'MINE' },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('mine');
  });

  it('executes else-body when condition is false', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{ property: { kind: 'INVENTORY', unit: '%' }, operator: '=', value: 100 }],
        operators: [],
        then: [{ type: 'DROP' }],
        else: [{ type: 'MINE' }],
      },
    ], { ore: 3, capacity: 10 }); // not full
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.waitingFor).toBe('mine');
  });
});

// ─── MOVE_TO ─────────────────────────────────────────────────────────────

describe('stepProgram — MOVE_TO', () => {
  let world: World;
  let grid: Grid;

  beforeEach(() => {
    world = makeWorld();
    grid = new Grid();
  });

  it('sets movement path and state=waiting waitingFor=move', () => {
    const targetId = world.createEntity();
    world.addComponent(targetId, 'Position', { x: 3, y: 0 });

    const { id, registry } = addDrone(world, 'running', [
      { type: 'MOVE_TO', targetEntityId: targetId },
    ]);
    world.getComponent(id, 'Position')!.x = 0;
    world.getComponent(id, 'Position')!.y = 0;

    stepProgram(id, world, registry, grid, EMPTY_OCCUPIED);

    const prog = world.getComponent(id, 'Program')!;
    const movement = world.getComponent(id, 'Movement')!;
    expect(prog.state).toBe('waiting');
    expect(prog.waitingFor).toBe('move');
    expect(movement.path.length).toBeGreaterThan(0);
    expect(movement.targetX).toBe(3);
    expect(movement.targetY).toBe(0);
  });

  it('skips path if target entity has no Position', () => {
    const ghostId = world.createEntity(); // no Position component

    const { id, registry } = addDrone(world, 'running', [
      { type: 'MOVE_TO', targetEntityId: ghostId },
    ]);

    stepProgram(id, world, registry, grid, EMPTY_OCCUPIED);

    const prog = world.getComponent(id, 'Program')!;
    // should still wait for move (drone stays put) or advance — we expect waiting
    expect(prog.state).toBe('waiting');
    expect(prog.waitingFor).toBe('move');
  });
});
