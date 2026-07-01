import { create } from "zustand";
import type { EntityId, WorldObjectType } from "../types/index.js";
import type { ProgramDef } from "@/game/programs/types.js";
import { CollisionSystem } from "../../game/simulation/systems/CollisionSystem.js";
import { ModifiersSystem } from "../../game/simulation/systems/ModifiersSystem.js";
import { ProgramExecutionSystem } from "../../game/simulation/systems/ProgramExecutionSystem.js";
import { MovementSystem } from "../../game/simulation/systems/MovementSystem.js";
import { MiningSystem } from "../../game/simulation/systems/MiningSystem.js";
import { EnergySystem } from "../../game/simulation/systems/EnergySystem.js";
import { StatisticsSystem } from "../../game/simulation/systems/StatisticsSystem.js";
import { CodeBehaviorDriver } from "../../game/code/CodeBehaviorDriver.js";
import { dependentsOf } from "../../game/code/linker/dependentsOf.js";
import { BrowserWorkerPort } from "../../game/code/worker/BrowserWorkerPort.js";
import type { GameStatus } from "@/game/types.js";
import type { Systems, GameStore } from "./types.js";
import {
  filterPrograms,
  resetDroneProgram,
  snapshotDrones,
  snapshotBuildings,
} from "./snapshots.js";

// Реэкспорт типов для внешних импортёров (публичный API стора неизменен).
export type {
  DroneState,
  StatsState,
  HoveredCell,
  SelectedCell,
  BuildingState,
} from "./types.js";
export { computeActivePath } from "./computeActivePath.js";

let _programIdCounter = 1;

export const useGameStore = create<GameStore>((set, get) => ({
  world: null,
  grid: null,
  registry: new Map(),
  drones: [],
  buildings: [],
  selectedDroneId: null,
  selectedCell: null,
  hoveredCell: null,
  programs: [],
  stats: { orePerMin: 0, congestion: 0, efficiency: 0, tick: 0, oreMined: 0 },
  isRunning: false,
  isStepMode: false,
  gameStatus: "idle" as GameStatus,
  statusMessage: null,
  _systems: null,
  _staticTypeMap: new Map(),
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
    const buildings = snapshotBuildings(world, typeMap);

    set({
      world,
      grid,
      registry,
      _systems: systems,
      _staticTypeMap: typeMap,
      programs,
      drones,
      buildings,
      selectedCell: null,
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
      buildings: snapshotBuildings(world, get()._staticTypeMap),
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
    // Выбор дрона и выбор клетки взаимоисключающи: INSPECTOR показывает что-то одно.
    set({ selectedDroneId: id, selectedCell: null });
  },

  selectCell(cell) {
    set({ selectedCell: cell, selectedDroneId: null });
  },

  setHoveredCell(cell) {
    const prev = get().hoveredCell;
    const same =
      prev === cell ||
      (prev !== null &&
        cell !== null &&
        prev.x === cell.x &&
        prev.y === cell.y);
    if (same) return;
    set({ hoveredCell: cell });
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
