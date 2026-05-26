import { create } from 'zustand';
import type { EntityId } from '../types/index.js';
import type { GameStatus } from '../../game/types.js';
import type { World } from '../../game/simulation/world/World.js';
import type { Grid } from '../../game/simulation/world/Grid.js';
import type { ProgramRegistry, ProgramDef, Instruction } from '../../game/programs/types.js';
import type { ProgramState, CallFrame } from '../../game/simulation/components/Program.js';
import { CollisionSystem } from '../../game/simulation/systems/CollisionSystem.js';
import { ProgramExecutionSystem } from '../../game/simulation/systems/ProgramExecutionSystem.js';
import { MovementSystem } from '../../game/simulation/systems/MovementSystem.js';
import { MiningSystem } from '../../game/simulation/systems/MiningSystem.js';
import { EnergySystem } from '../../game/simulation/systems/EnergySystem.js';
import { StatisticsSystem } from '../../game/simulation/systems/StatisticsSystem.js';

export interface DroneState {
  id: EntityId;
  position: { x: number; y: number };
  energy: { current: number; max: number };
  inventory: { ore: number; capacity: number };
  programState: ProgramState;
  currentInstruction: string;
  currentProgramId: string | null;
  currentInstructionPath: number[] | null;
  waitingFor: string | null;
  personalProgramId: string;
  assignedProgramId?: string;
  localPaused: boolean;
}

export function computeActivePath(
  callStack: CallFrame[],
  state: ProgramState
): number[] | null {
  if (callStack.length === 0) return null;

  const path: number[] = [];

  for (let i = 0; i < callStack.length; i++) {
    const frame = callStack[i];
    const isTop = i === callStack.length - 1;

    if (isTop) {
      const isWaiting =
        state === 'waiting' ||
        (frame.waitRemaining !== undefined && frame.waitRemaining > 0);
      const idx = isWaiting ? frame.instructionIndex - 1 : frame.instructionIndex;
      if (idx < 0) return null;
      path.push(idx);
    } else {
      path.push(frame.instructionIndex);
    }
  }

  return path;
}

export interface StatsState {
  orePerMin: number;
  congestion: number;
  efficiency: number;
  tick: number;
  oreMined: number;
}

interface Systems {
  collision: CollisionSystem;
  programExecution: ProgramExecutionSystem;
  movement: MovementSystem;
  mining: MiningSystem;
  energy: EnergySystem;
  statistics: StatisticsSystem;
}

interface GameStore {
  world: World | null;
  grid: Grid | null;
  registry: ProgramRegistry;
  drones: DroneState[];
  selectedDroneId: EntityId | null;
  programs: ProgramDef[];
  stats: StatsState;
  isRunning: boolean;
  gameStatus: GameStatus;
  statusMessage: string | null;
  _systems: Systems | null;
  _tickCount: number;

  init(world: World, grid: Grid, registry: ProgramRegistry): void;
  tick(): void;
  selectDrone(id: EntityId | null): void;
  setRunning(v: boolean): void;
  stepOnce(): void;
  setGameStatus(status: GameStatus, message?: string): void;
  addInstruction(programId: string, instruction: Instruction, parentPath?: number[]): void;
  removeInstruction(programId: string, path: number[]): void;
  updateInstruction(programId: string, path: number[], updated: Instruction): void;
  moveInstruction(programId: string, fromPath: number[], toContainerPath: number[], toIndex: number): void;
  createProgram(name: string): void;
  assignProgram(droneId: EntityId, programId: string): void;
  unassignProgram(droneId: EntityId): void;
  restartProgram(droneId: EntityId): void;
  startDrone(droneId: EntityId): void;
  pauseDrone(droneId: EntityId): void;
  resetDrone(droneId: EntityId): void;
}

function describeInstruction(instr: Instruction): string {
  switch (instr.type) {
    case 'MOVE_TO': return `MOVE → #${instr.targetEntityId}`;
    case 'MINE': return 'MINE';
    case 'DROP': return 'DROP';
    case 'CHARGE': return 'CHARGE';
    case 'WAIT': return `WAIT ${instr.seconds}s`;
    case 'LOOP': return 'LOOP ∞';
    case 'REPEAT': return `REPEAT ×${instr.count}`;
    case 'RUN_PROGRAM': return `RUN ${instr.programId}`;
    case 'IF': return `IF (${instr.conditions.length} condition${instr.conditions.length !== 1 ? 's' : ''})`;
  }
}

function getInstructionList(instructions: Instruction[], path: number[]): Instruction[] {
  let current = instructions;
  for (const idx of path) {
    const node = current[idx];
    if (!node) return current;
    if (node.type === 'LOOP' || node.type === 'REPEAT') {
      current = node.body;
    } else if (node.type === 'IF') {
      current = node.then;
    } else {
      break;
    }
  }
  return current;
}

function resetDroneProgram(world: World, droneId: EntityId): void {
  const program = world.getComponent(droneId, 'Program');
  if (!program || !program.currentProgramId) return;
  program.callStack = [{ programId: program.currentProgramId, instructionIndex: 0 }];
  program.state = 'running';
  program.waitingFor = undefined;
  program.mineElapsed = undefined;
  program.chargeElapsed = undefined;
  program.dropElapsed = undefined;
  const movement = world.getComponent(droneId, 'Movement');
  if (movement) {
    movement.path = [];
    movement.progress = 0;
  }
}

function snapshotDrones(world: World, registry: ProgramRegistry): DroneState[] {
  const ids = world.query('Position', 'Energy', 'Inventory', 'Program');
  return ids.map((id) => {
    const pos = world.getComponent(id, 'Position')!;
    const energy = world.getComponent(id, 'Energy')!;
    const inventory = world.getComponent(id, 'Inventory')!;
    const program = world.getComponent(id, 'Program')!;

    let currentInstruction = '—';
    const frame = program.callStack[program.callStack.length - 1];
    if (frame) {
      const isWaiting =
        program.state === 'waiting' ||
        (frame.waitRemaining !== undefined && frame.waitRemaining > 0);
      const idx = isWaiting ? frame.instructionIndex - 1 : frame.instructionIndex;
      if (idx >= 0) {
        const prog = registry.get(frame.programId);
        if (prog) {
          const instr = prog.instructions[idx];
          if (instr) currentInstruction = describeInstruction(instr);
        }
      }
    }

    return {
      id,
      position: { x: pos.x, y: pos.y },
      energy: { current: energy.current, max: energy.max },
      inventory: { ore: inventory.ore, capacity: inventory.capacity },
      programState: program.state,
      currentInstruction,
      currentProgramId: program.currentProgramId,
      currentInstructionPath: computeActivePath(program.callStack, program.state),
      waitingFor: program.waitingFor ?? null,
      personalProgramId: program.personalProgramId,
      assignedProgramId: program.assignedProgramId,
      localPaused: program.localPaused ?? false,
    };
  });
}

let _programIdCounter = 1;

export const useGameStore = create<GameStore>((set, get) => ({
  world: null,
  grid: null,
  registry: new Map(),
  drones: [],
  selectedDroneId: null,
  programs: [],
  stats: { orePerMin: 0, congestion: 0, efficiency: 0, tick: 0, oreMined: 0 },
  isRunning: false,
  gameStatus: 'idle' as GameStatus,
  statusMessage: null,
  _systems: null,
  _tickCount: 0,

  init(world, grid, registry) {
    get()._systems?.statistics.destroy();
    const collision = new CollisionSystem(world);
    const programExecution = new ProgramExecutionSystem(world, grid, collision, registry);
    const movement = new MovementSystem(world);
    const mining = new MiningSystem(world);
    const energy = new EnergySystem(world);
    const statistics = new StatisticsSystem(world);

    const systems: Systems = { collision, programExecution, movement, mining, energy, statistics };
    const programs = Array.from(registry.values()).filter(p => !p.personal);
    const drones = snapshotDrones(world, registry);

    set({
      world, grid, registry, _systems: systems, programs, drones,
      _tickCount: 0,
      stats: { orePerMin: 0, congestion: 0, efficiency: 0, tick: 0, oreMined: 0 },
      isRunning: false,
      gameStatus: 'idle',
      statusMessage: null,
    });
  },

  tick() {
    const { world, registry, _systems } = get();
    if (!world || !_systems) return;

    _systems.collision.update();
    _systems.programExecution.update();
    _systems.movement.update();
    _systems.mining.update();
    _systems.energy.update();
    _systems.statistics.update();

    const s = _systems.statistics.stats;
    const tickCount = get()._tickCount + 1;

    set({
      drones: snapshotDrones(world, registry),
      stats: {
        orePerMin: Math.round(s.orePerMinute * 10) / 10,
        congestion: s.totalDrones > 0
          ? Math.round((s.congestionEvents / Math.max(tickCount, 1)) * 100)
          : 0,
        efficiency: Math.round(s.efficiency * 100),
        tick: tickCount,
        oreMined: s.oreMined,
      },
      _tickCount: tickCount,
    });
  },

  selectDrone(id) {
    set({ selectedDroneId: id });
  },

  setRunning(v) {
    set({ isRunning: v });
  },

  stepOnce() {
    get().tick();
  },

  setGameStatus(status, message) {
    set({ gameStatus: status, statusMessage: message ?? null });
  },

  addInstruction(programId, instruction, parentPath = []) {
    const { registry } = get();
    const prog = registry.get(programId);
    if (!prog) return;

    const list = getInstructionList(prog.instructions, parentPath);
    list.push(instruction);

    set({ programs: Array.from(registry.values()).filter(p => !p.personal) });
  },

  removeInstruction(programId, path) {
    const { registry } = get();
    const prog = registry.get(programId);
    if (!prog || path.length === 0) return;

    const parentPath = path.slice(0, -1);
    const idx = path[path.length - 1];
    const list = getInstructionList(prog.instructions, parentPath);
    list.splice(idx, 1);

    set({ programs: Array.from(registry.values()).filter(p => !p.personal) });
  },

  updateInstruction(programId, path, updated) {
    const { registry } = get();
    const prog = registry.get(programId);
    if (!prog || path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const idx = path[path.length - 1];
    const list = getInstructionList(prog.instructions, parentPath);
    list[idx] = updated;
    set({ programs: Array.from(registry.values()).filter(p => !p.personal) });
  },

  moveInstruction(programId, fromPath, toContainerPath, toIndex) {
    const { registry } = get();
    const prog = registry.get(programId);
    if (!prog || fromPath.length === 0) return;

    const fromContainerPath = fromPath.slice(0, -1);
    const fromIndex = fromPath[fromPath.length - 1];

    // Если удаление fromPath сдвигает сегмент в toContainerPath — скорректировать
    const adjustedToContainerPath = toContainerPath.slice();
    if (
      adjustedToContainerPath.length > fromContainerPath.length &&
      fromContainerPath.every((v, i) => v === adjustedToContainerPath[i]) &&
      adjustedToContainerPath[fromContainerPath.length] > fromIndex
    ) {
      adjustedToContainerPath[fromContainerPath.length]--;
    }

    const fromList = getInstructionList(prog.instructions, fromContainerPath);
    const instr = fromList[fromIndex];
    if (!instr) return;

    fromList.splice(fromIndex, 1);
    const toList = getInstructionList(prog.instructions, adjustedToContainerPath);
    toList.splice(toIndex, 0, instr);

    set({ programs: Array.from(registry.values()).filter(p => !p.personal) });
  },

  createProgram(name) {
    const { registry } = get();
    const id = `program_${_programIdCounter++}`;
    const prog: ProgramDef = { id, name, instructions: [] };
    registry.set(id, prog);
    set({ programs: Array.from(registry.values()).filter(p => !p.personal) });
  },

  assignProgram(droneId, programId) {
    const { world } = get();
    if (!world) return;
    const program = world.getComponent(droneId, 'Program');
    if (!program) return;

    program.assignedProgramId = programId;
    program.currentProgramId = programId;
    program.callStack = [{ programId, instructionIndex: 0 }];
    program.state = 'running';
    program.waitingFor = undefined;

    set({ drones: snapshotDrones(world, get().registry) });
  },

  unassignProgram(droneId) {
    const { world, registry } = get();
    if (!world) return;
    const program = world.getComponent(droneId, 'Program');
    if (!program) return;

    program.assignedProgramId = undefined;
    program.currentProgramId = program.personalProgramId;
    program.callStack = [{ programId: program.personalProgramId, instructionIndex: 0 }];
    program.state = 'running';
    program.waitingFor = undefined;

    const movement = world.getComponent(droneId, 'Movement');
    if (movement) {
      movement.path = [];
      movement.progress = 0;
    }

    set({ drones: snapshotDrones(world, registry) });
  },

  restartProgram(droneId) {
    const { world, registry } = get();
    if (!world) return;
    resetDroneProgram(world, droneId);
    set({ drones: snapshotDrones(world, registry) });
  },

  startDrone(droneId) {
    const { world, registry } = get();
    if (!world) return;
    const program = world.getComponent(droneId, 'Program');
    if (!program) return;
    program.localPaused = false;
    set({ drones: snapshotDrones(world, registry) });
  },

  pauseDrone(droneId) {
    const { world, registry } = get();
    if (!world) return;
    const program = world.getComponent(droneId, 'Program');
    if (!program) return;
    program.localPaused = true;
    set({ drones: snapshotDrones(world, registry) });
  },

  resetDrone(droneId) {
    const { world, registry } = get();
    if (!world) return;
    resetDroneProgram(world, droneId);
    const program = world.getComponent(droneId, 'Program');
    if (program) program.localPaused = false;
    set({ drones: snapshotDrones(world, registry) });
  },
}));
