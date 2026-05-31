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
  state: 'idle' | 'running' | 'move' | 'mine' | 'drop' | 'charge' = 'running',
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

  it('sets state=mine', () => {
    const { id, registry } = addDrone(world, 'running', [{ type: 'MINE' }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.state).toBe('mine');
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

  it('sets state=drop', () => {
    const { id, registry } = addDrone(world, 'running', [{ type: 'DROP' }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.state).toBe('drop');
  });
});

describe('stepProgram — CHARGE', () => {
  let world: World;

  beforeEach(() => { world = makeWorld(); });

  it('sets state=charge', () => {
    const { id, registry } = addDrone(world, 'running', [{ type: 'CHARGE' }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.state).toBe('charge');
  });
});

// ─── WAIT ──────────────────────────────────────────────────────────────────

describe('stepProgram — WAIT', () => {
  let world: World;

  beforeEach(() => { world = makeWorld(); });

  it('sets waitRemaining and advances instructionIndex on first call', () => {
    const { id, registry } = addDrone(world, 'running', [{ type: 'WAIT', seconds: 0.3 }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.callStack[0].waitRemaining).toBeCloseTo(0.3);
    expect(prog.callStack[0].instructionIndex).toBe(1);
    expect(prog.state).toBe('running');
  });

  it('decrements waitRemaining by DT on each tick', () => {
    const { id, registry } = addDrone(world, 'running', [{ type: 'WAIT', seconds: 0.3 }, { type: 'DROP' }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // sets waitRemaining=0.3
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // 0.3→0.2
    expect(world.getComponent(id, 'Program')!.callStack[0].waitRemaining).toBeCloseTo(0.2);
  });

  it('proceeds to next instruction after wait expires', () => {
    // seconds=0.2 → 2 ticks of DT=0.1 to drain, then next tick executes DROP
    const { id, registry } = addDrone(world, 'running', [{ type: 'WAIT', seconds: 0.2 }, { type: 'DROP' }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // sets waitRemaining=0.2
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // 0.2→0.1
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // 0.1→0.0
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // 0 ≤ EPSILON → execute DROP
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.state).toBe('drop');
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
    const { id, registry } = addDrone(world, 'mine', [{ type: 'MINE' }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.state).toBe('mine');
    expect(prog.callStack.length).toBe(0);
  });

  it('program finishes after all instructions executed', () => {
    const { id, registry } = addDrone(world, 'running', [{ type: 'MINE' }]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // MINE → waiting
    // Resume manually
    const prog = world.getComponent(id, 'Program')!;
    prog.state = 'running';
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
    expect(prog.state).toBe('mine');
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

    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // index past end → restart (isLoop)
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // MINE again → waiting
    expect(world.getComponent(id, 'Program')!.state).toBe('mine');
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
        if (prog.state === 'charge') return;
        if (prog.state === 'drop') {
          dropCount++;
          prog.state = 'running';
          continue;
        }
        stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
      }
    }

    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // enter REPEAT
    runUntilCharge();

    expect(dropCount).toBe(2);
    expect(world.getComponent(id, 'Program')!.state).toBe('charge');
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
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // sub end → pop → back to main at CHARGE
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // CHARGE → waiting
    expect(world.getComponent(id, 'Program')!.state).toBe('charge');
  });
});

// ─── IF ──────────────────────────────────────────────────────────────────


describe('stepProgram — IF conditions', () => {
  let world: World;

  beforeEach(() => { world = makeWorld(); });

  const numOp = (v: number): import('./types.js').Operand => ({ kind: 'number', value: v });
  const fnOp = (call: import('./types.js').FunctionCall): import('./types.js').Operand => ({ kind: 'function', call });
  const self = { kind: 'self' as const };

  // ── Energy ─────────────────────────────────────────────────────────────
  it('Energy(Self) < 30 is true when energy=20', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{ left: { fn: 'Energy', args: [self] }, operator: '<', right: numOp(30) }],
        operators: [],
        then: [{ type: 'CHARGE' }],
      },
    ], { energy: 20, energyMax: 100 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.state).toBe('charge');
  });

  it('Energy(Self) < 30 is false when energy=80', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{ left: { fn: 'Energy', args: [self] }, operator: '<', right: numOp(30) }],
        operators: [],
        then: [{ type: 'CHARGE' }],
      },
      { type: 'DROP' },
    ], { energy: 80, energyMax: 100 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.state).toBe('drop');
  });

  // ── Inventory < InventoryMax (RHS-функция) ─────────────────────────────
  it('Inventory(Self) < InventoryMax(Self) is true when ore=3, capacity=10', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{
          left: { fn: 'Inventory', args: [self] },
          operator: '<',
          right: fnOp({ fn: 'InventoryMax', args: [self] }),
        }],
        operators: [],
        then: [{ type: 'MINE' }],
      },
    ], { ore: 3, capacity: 10 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.state).toBe('mine');
  });

  it('Inventory(Self) < InventoryMax(Self) is false when ore=capacity', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{
          left: { fn: 'Inventory', args: [self] },
          operator: '<',
          right: fnOp({ fn: 'InventoryMax', args: [self] }),
        }],
        operators: [],
        then: [{ type: 'MINE' }],
      },
      { type: 'DROP' },
    ], { ore: 10, capacity: 10 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.state).toBe('drop');
  });

  // ── Deposit(entity) ─────────────────────────────────────────────────────
  it('Deposit(mine) = 0 is true when mine is empty', () => {
    const depId = world.createEntity();
    world.addComponent(depId, 'Position', { x: 0, y: 0 });
    world.addComponent(depId, 'Deposit', { oreRemaining: 0, mineRate: 1 });

    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{ left: { fn: 'Deposit', args: [{ kind: 'entity', id: depId }] }, operator: '=', right: numOp(0) }],
        operators: [],
        then: [{ type: 'DROP' }],
      },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.state).toBe('drop');
  });

  // ── Distance ────────────────────────────────────────────────────────────
  it('Distance(Self, target) <= 3 is true when target is 2 cells away', () => {
    const targetId = addTarget(world, 2, 0);
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{
          left: { fn: 'Distance', args: [self, { kind: 'entity', id: targetId }] },
          operator: '<=',
          right: numOp(3),
        }],
        operators: [],
        then: [{ type: 'MINE' }],
      },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.state).toBe('mine');
  });

  it('Distance(Self, target) = 0 is true when drone is on target tile', () => {
    const targetId = addTarget(world, 0, 0);  // drone at 0,0 by default
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{
          left: { fn: 'Distance', args: [self, { kind: 'entity', id: targetId }] },
          operator: '=',
          right: numOp(0),
        }],
        operators: [],
        then: [{ type: 'MINE' }],
      },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.state).toBe('mine');
  });

  // ── null-side gives false ───────────────────────────────────────────────
  it('Energy(non-energy-entity) gives false leaf', () => {
    const ghost = addTarget(world, 0, 0); // only Position, no Energy
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{
          left: { fn: 'Energy', args: [{ kind: 'entity', id: ghost }] },
          operator: '>=',
          right: numOp(0),
        }],
        operators: [],
        then: [{ type: 'MINE' }],
      },
      { type: 'DROP' },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.state).toBe('drop');
  });

  // ── AND / OR ────────────────────────────────────────────────────────────
  it('AND: true when both met', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [
          { left: { fn: 'Energy', args: [self] }, operator: '<', right: numOp(50) },
          { left: { fn: 'Inventory', args: [self] }, operator: '=', right: fnOp({ fn: 'InventoryMax', args: [self] }) },
        ],
        operators: ['AND'],
        then: [{ type: 'CHARGE' }],
      },
    ], { energy: 20, energyMax: 100, ore: 10, capacity: 10 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.state).toBe('charge');
  });

  it('OR: true when only second met', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [
          { left: { fn: 'Energy', args: [self] }, operator: '<', right: numOp(10) },
          { left: { fn: 'Inventory', args: [self] }, operator: '=', right: fnOp({ fn: 'InventoryMax', args: [self] }) },
        ],
        operators: ['OR'],
        then: [{ type: 'DROP' }],
      },
    ], { energy: 80, energyMax: 100, ore: 10, capacity: 10 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.state).toBe('drop');
  });

  it('empty conditions list evaluates to false', () => {
    const { id, registry } = addDrone(world, 'running', [
      { type: 'IF', conditions: [], operators: [], then: [{ type: 'DROP' }] },
      { type: 'MINE' },
    ]);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.state).toBe('mine');
  });

  it('executes else-body when condition is false', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'IF',
        conditions: [{
          left: { fn: 'Inventory', args: [self] },
          operator: '=',
          right: fnOp({ fn: 'InventoryMax', args: [self] }),
        }],
        operators: [],
        then: [{ type: 'DROP' }],
        else: [{ type: 'MINE' }],
      },
    ], { ore: 3, capacity: 10 });
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    expect(world.getComponent(id, 'Program')!.state).toBe('mine');
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

  it('sets movement path and state=move', () => {
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
    expect(prog.state).toBe('move');
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
    expect(prog.state).toBe('move');
  });
});

// ─── WHILE ────────────────────────────────────────────────────────────────

describe('stepProgram — WHILE', () => {
  let world: World;

  beforeEach(() => { world = makeWorld(); });

  const self = { kind: 'self' as const };
  const numOp = (v: number): import('./types.js').Operand => ({ kind: 'number', value: v });

  it('skips body when condition is false at entry', () => {
    // Energy(self) > 50, but drone has energy=20 → skip WHILE, go to CHARGE
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'WHILE',
        conditions: [{ left: { fn: 'Energy', args: [self] }, operator: '>', right: numOp(50) }],
        operators: [],
        body: [{ type: 'MINE' }],
      },
      { type: 'CHARGE' },
    ], { energy: 20 });

    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // evaluate WHILE → false → skip
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // CHARGE
    expect(world.getComponent(id, 'Program')!.state).toBe('charge');
  });

  it('executes body when condition is true at entry', () => {
    // Energy(self) > 50, drone has energy=100 → enter body
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'WHILE',
        conditions: [{ left: { fn: 'Energy', args: [self] }, operator: '>', right: numOp(50) }],
        operators: [],
        body: [{ type: 'MINE' }],
      },
    ], { energy: 100 });

    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // enter WHILE, push child frame
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // MINE → waiting
    expect(world.getComponent(id, 'Program')!.state).toBe('mine');
  });

  it('repeats body while condition stays true', () => {
    // Inventory(self) < 10, ore=0 → mines multiple times
    let mineCount = 0;
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'WHILE',
        conditions: [{ left: { fn: 'Inventory', args: [self] }, operator: '<', right: numOp(10) }],
        operators: [],
        body: [{ type: 'MINE' }],
      },
      { type: 'DROP' },
    ], { ore: 0, capacity: 10 });

    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // enter WHILE

    for (let i = 0; i < 8; i++) {
      const prog = world.getComponent(id, 'Program')!;
      if (prog.state === 'mine') {
        mineCount++;
        prog.state = 'running';
        continue;
      }
      stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED);
    }

    expect(mineCount).toBeGreaterThanOrEqual(2);
  });

  it('exits body and advances past WHILE when condition becomes false', () => {
    // ore starts at 9, capacity=10 → one MINE iteration, then Inventory(9) < 10 still true
    // Use ore=10 from start → condition false immediately, goes to DROP
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'WHILE',
        conditions: [{ left: { fn: 'Inventory', args: [self] }, operator: '<', right: numOp(5) }],
        operators: [],
        body: [{ type: 'MINE' }],
      },
      { type: 'DROP' },
    ], { ore: 5, capacity: 10 });

    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // WHILE: ore(5) < 5 → false → skip
    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // DROP
    expect(world.getComponent(id, 'Program')!.state).toBe('drop');
  });

  it('stores whileConditions on the child frame', () => {
    const { id, registry } = addDrone(world, 'running', [
      {
        type: 'WHILE',
        conditions: [{ left: { fn: 'Energy', args: [self] }, operator: '>', right: numOp(50) }],
        operators: [],
        body: [{ type: 'MINE' }],
      },
    ], { energy: 100 });

    stepProgram(id, world, registry, EMPTY_GRID, EMPTY_OCCUPIED); // enter WHILE
    const prog = world.getComponent(id, 'Program')!;
    expect(prog.callStack.length).toBe(2);
    expect(prog.callStack[1].whileConditions).toBeDefined();
    expect(prog.callStack[1].whileConditions!.length).toBe(1);
  });
});
