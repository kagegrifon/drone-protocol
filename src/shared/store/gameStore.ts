import { create } from "zustand";
import type { EntityId, WorldObjectType } from "../types/index.js";
import type { GameStatus } from "@/game/types.js";
import type { World } from "@/game/simulation/world/World.js";
import type { Grid } from "@/game/simulation/world/Grid.js";
import type { ProgramRegistry, ProgramDef } from "@/game/programs/types.js";
import type {
  ProgramState,
  CallFrame,
} from "../../game/simulation/components/Program.js";
import { CollisionSystem } from "../../game/simulation/systems/CollisionSystem.js";
import { ModifiersSystem } from "../../game/simulation/systems/ModifiersSystem.js";
import { ProgramExecutionSystem } from "../../game/simulation/systems/ProgramExecutionSystem.js";
import { MovementSystem } from "../../game/simulation/systems/MovementSystem.js";
import { MiningSystem } from "../../game/simulation/systems/MiningSystem.js";
import { EnergySystem } from "../../game/simulation/systems/EnergySystem.js";
import { StatisticsSystem } from "../../game/simulation/systems/StatisticsSystem.js";
import { CodeBehaviorDriver } from "../../game/code/CodeBehaviorDriver.js";
import { dependentsOf } from "../../game/code/linker/dependentsOf.js";
import type { StackFrame } from "../../game/code/linker/mapLine.js";
import { BrowserWorkerPort } from "../../game/code/worker/BrowserWorkerPort.js";
import type { CodeWorkerPort } from "../../game/code/CodeWorkerPort.js";

export interface DroneState {
  id: EntityId;
  position: { x: number; y: number };
  energy: { current: number; max: number };
  inventory: { ore: number; capacity: number };
  programState: ProgramState;
  currentInstruction: string;
  currentProgramId: string | null;
  currentInstructionPath: number[] | null;
  personalProgramId: string;
  assignedProgramId?: string;
  localPaused: boolean;
  codeError?: string;
  currentLine: number | null;
  codeStack: StackFrame[] | null;
}

export function computeActivePath(
  callStack: CallFrame[],
  state: ProgramState,
): number[] | null {
  if (callStack.length === 0) return null;

  const path: number[] = [];

  for (let i = 0; i < callStack.length; i++) {
    const frame = callStack[i];
    const isTop = i === callStack.length - 1;

    if (isTop) {
      const isWaiting =
        (state !== "idle" && state !== "running") ||
        (frame.waitRemaining !== undefined && frame.waitRemaining > 0);
      const idx = isWaiting
        ? frame.instructionIndex - 1
        : frame.instructionIndex;
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
  modifiers: ModifiersSystem;
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
  isStepMode: boolean;
  gameStatus: GameStatus;
  statusMessage: string | null;
  _systems: Systems | null;
  _tickCount: number;

  init(
    world: World,
    grid: Grid,
    registry: ProgramRegistry,
    options?: {
      createPort?: () => CodeWorkerPort;
      staticEntities?: ReadonlyArray<{
        id: EntityId;
        type: WorldObjectType;
      }>;
    },
  ): void;
  setProgramCodeSource(programId: string, code: string): void;
  tick(): void;
  selectDrone(id: EntityId | null): void;
  setRunning(v: boolean): void;
  setStepMode(v: boolean): void;
  stepOnce(): void;
  setGameStatus(status: GameStatus, message?: string): void;
  createProgram(name: string): string;
  assignProgram(droneId: EntityId, programId: string): void;
  unassignProgram(droneId: EntityId): void;
  restartProgram(droneId: EntityId): void;
  startDrone(droneId: EntityId): void;
  pauseDrone(droneId: EntityId): void;
  resetDrone(droneId: EntityId): void;
}

function filterPrograms(registry: ProgramRegistry): ProgramDef[] {
  return Array.from(registry.values()).filter((p) => !p.personal);
}

function resetDroneProgram(world: World, droneId: EntityId): void {
  const program = world.getComponent(droneId, "Program");
  if (!program || !program.currentProgramId) return;
  program.callStack = [
    { programId: program.currentProgramId, instructionIndex: 0 },
  ];
  program.state = "running";
  program.mineProgress = undefined;
  program.chargeProgress = undefined;
  program.dropProgress = undefined;
  const movement = world.getComponent(droneId, "Movement");
  if (movement) {
    movement.path = [];
    movement.progress = 0;
  }
}

function snapshotDrones(world: World): DroneState[] {
  const ids = world.query("Position", "Energy", "Inventory", "Program");
  return ids.map((id) => {
    const pos = world.getComponent(id, "Position")!;
    const energy = world.getComponent(id, "Energy")!;
    const inventory = world.getComponent(id, "Inventory")!;
    const program = world.getComponent(id, "Program")!;

    let currentInstruction = "—";
    const frame = program.callStack[program.callStack.length - 1];
    if (frame) {
      const isWaiting =
        (program.state !== "idle" && program.state !== "running") ||
        (frame.waitRemaining !== undefined && frame.waitRemaining > 0);
      const idx = isWaiting
        ? frame.instructionIndex - 1
        : frame.instructionIndex;
      if (idx >= 0) {
        currentInstruction = "-TODO-"; // понять что тут выводить
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
      currentInstructionPath: computeActivePath(
        program.callStack,
        program.state,
      ),
      personalProgramId: program.personalProgramId,
      assignedProgramId: program.assignedProgramId,
      localPaused: program.localPaused ?? false,
      codeError: program.codeError,
      currentLine: program.currentLine ?? null,
      codeStack: program.codeStack ?? null,
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
  isStepMode: false,
  gameStatus: "idle" as GameStatus,
  statusMessage: null,
  _systems: null,
  _tickCount: 0,

  init(world, grid, registry, options) {
    get()._systems?.statistics.destroy();
    get()._systems?.programExecution.dispose();
    const collision = new CollisionSystem(world);
    const modifiers = new ModifiersSystem(world);
    const typeMap = new Map<EntityId, WorldObjectType>(
      (options?.staticEntities ?? []).map((e) => [e.id, e.type]),
    );
    const codeDriver = new CodeBehaviorDriver({
      createPort: options?.createPort ?? (() => new BrowserWorkerPort()),
      typeMap,
    });
    const programExecution = new ProgramExecutionSystem(
      world,
      grid,
      collision,
      registry,
      codeDriver,
    );
    const movement = new MovementSystem(world);
    const mining = new MiningSystem(world);
    const energy = new EnergySystem(world);
    const statistics = new StatisticsSystem(world);

    const systems: Systems = {
      collision,
      modifiers,
      programExecution,
      movement,
      mining,
      energy,
      statistics,
    };

    const programs = filterPrograms(registry);
    const drones = snapshotDrones(world);

    set({
      world,
      grid,
      registry,
      _systems: systems,
      programs,
      drones,
      _tickCount: 0,
      stats: {
        orePerMin: 0,
        congestion: 0,
        efficiency: 0,
        tick: 0,
        oreMined: 0,
      },
      isRunning: false,
      gameStatus: "idle",
      statusMessage: null,
    });
  },

  tick() {
    const { world, _systems } = get();
    if (!world || !_systems) return;

    _systems.collision.update();
    _systems.modifiers.update();
    _systems.programExecution.update();
    _systems.movement.update();
    _systems.mining.update();
    _systems.energy.update();
    _systems.statistics.update();

    const s = _systems.statistics.stats;
    const tickCount = get()._tickCount + 1;

    set({
      drones: snapshotDrones(world),
      stats: {
        orePerMin: Math.round(s.orePerMinute * 10) / 10,
        congestion:
          s.totalDrones > 0
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

  setStepMode(v) {
    set({ isStepMode: v });
  },

  stepOnce() {
    get().tick();
  },

  setGameStatus(status, message) {
    set({ gameStatus: status, statusMessage: message ?? null });
  },

  setProgramCodeSource(programId, code) {
    const { registry, world, _systems } = get();
    const prog = registry.get(programId);
    if (!prog || prog.behavior.sourceForm !== "code") return;
    prog.behavior.code = code;

    if (world && _systems) {
      // Перезапускаем дронов всех программ, которые транзитивно импортируют
      // изменённую (включая её саму) — их склеенный код устарел.
      const affected = new Set(dependentsOf(programId, registry));
      for (const droneId of world.query(
        "Position",
        "Energy",
        "Inventory",
        "Program",
      )) {
        const program = world.getComponent(droneId, "Program")!;
        const activeId = program.currentProgramId ?? program.personalProgramId;
        if (affected.has(activeId)) {
          _systems.programExecution.disposeDrone(droneId);
        }
      }
    }

    set({ programs: filterPrograms(registry) });
  },

  createProgram(name) {
    const { registry } = get();
    const id = `program_${_programIdCounter++}`;
    const prog: ProgramDef = {
      id,
      name,
      behavior: { sourceForm: "code", code: "" },
    };
    registry.set(id, prog);
    set({ programs: filterPrograms(registry) });
    return id;
  },

  assignProgram(droneId, programId) {
    const { world } = get();
    if (!world) return;
    const program = world.getComponent(droneId, "Program");
    if (!program) return;

    program.assignedProgramId = programId;
    program.currentProgramId = programId;
    program.callStack = [{ programId, instructionIndex: 0 }];
    program.state = "running";

    set({ drones: snapshotDrones(world) });
  },

  unassignProgram(droneId) {
    const { world } = get();
    if (!world) return;
    const program = world.getComponent(droneId, "Program");
    if (!program) return;

    program.assignedProgramId = undefined;
    program.currentProgramId = program.personalProgramId;
    program.callStack = [
      { programId: program.personalProgramId, instructionIndex: 0 },
    ];
    program.state = "running";

    const movement = world.getComponent(droneId, "Movement");
    if (movement) {
      movement.path = [];
      movement.progress = 0;
    }

    set({ drones: snapshotDrones(world) });
  },

  restartProgram(droneId) {
    const { world } = get();
    if (!world) return;
    resetDroneProgram(world, droneId);
    set({ drones: snapshotDrones(world) });
  },

  startDrone(droneId) {
    const { world } = get();
    if (!world) return;
    const program = world.getComponent(droneId, "Program");
    if (!program) return;
    program.localPaused = false;
    set({ drones: snapshotDrones(world) });
  },

  pauseDrone(droneId) {
    const { world } = get();
    if (!world) return;
    const program = world.getComponent(droneId, "Program");
    if (!program) return;
    program.localPaused = true;
    set({ drones: snapshotDrones(world) });
  },

  resetDrone(droneId) {
    const { world } = get();
    if (!world) return;
    resetDroneProgram(world, droneId);
    const program = world.getComponent(droneId, "Program");
    if (program) program.localPaused = false;
    set({ drones: snapshotDrones(world) });
  },
}));
