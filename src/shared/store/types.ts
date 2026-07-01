import type { EntityId, WorldObjectType } from "../types/index.js";
import type { GameStatus } from "@/game/types.js";
import type { World } from "@/game/simulation/world/World.js";
import type { Grid } from "@/game/simulation/world/Grid.js";
import type { ProgramRegistry, ProgramDef } from "@/game/programs/types.js";
import type { ProgramState } from "../../game/simulation/components/Program.js";
import type { StackFrame } from "../../game/code/linker/mapLine.js";
import type { CollisionSystem } from "../../game/simulation/systems/CollisionSystem.js";
import type { ModifiersSystem } from "../../game/simulation/systems/ModifiersSystem.js";
import type { ProgramExecutionSystem } from "../../game/simulation/systems/ProgramExecutionSystem.js";
import type { MovementSystem } from "../../game/simulation/systems/MovementSystem.js";
import type { MiningSystem } from "../../game/simulation/systems/MiningSystem.js";
import type { EnergySystem } from "../../game/simulation/systems/EnergySystem.js";
import type { StatisticsSystem } from "../../game/simulation/systems/StatisticsSystem.js";
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

export interface StatsState {
  orePerMin: number;
  congestion: number;
  efficiency: number;
  tick: number;
  oreMined: number;
}

export type HoveredCell = { x: number; y: number } | null;

export type SelectedCell = { x: number; y: number } | null;

/**
 * Здание (шахта/база/зарядка) для INSPECTOR. `ref` — строка вида `World.mines[0]`,
 * которую игрок может вставить в код дрона. Индекс совпадает с индексом в World API,
 * т.к. порядок берётся из того же `typeMap`, что видит код дрона (см. collectWorld).
 */
export interface BuildingState {
  entityId: EntityId;
  type: WorldObjectType;
  x: number;
  y: number;
  ref: string;
  /** Остаток руды — только для шахты. */
  oreRemaining?: number;
}

export interface Systems {
  collision: CollisionSystem;
  modifiers: ModifiersSystem;
  programExecution: ProgramExecutionSystem;
  movement: MovementSystem;
  mining: MiningSystem;
  energy: EnergySystem;
  statistics: StatisticsSystem;
}

export interface GameStore {
  world: World | null;
  grid: Grid | null;
  registry: ProgramRegistry;
  drones: DroneState[];
  buildings: BuildingState[];
  selectedDroneId: EntityId | null;
  selectedCell: SelectedCell;
  hoveredCell: HoveredCell;
  programs: ProgramDef[];
  stats: StatsState;
  isRunning: boolean;
  isStepMode: boolean;
  gameStatus: GameStatus;
  statusMessage: string | null;
  _systems: Systems | null;
  _staticTypeMap: ReadonlyMap<EntityId, WorldObjectType>;
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
  selectCell(cell: SelectedCell): void;
  setHoveredCell(cell: HoveredCell): void;
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
