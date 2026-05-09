import type { WinCondition, FailCondition, GameConfig } from './types.js';
import type { StatsState } from '../shared/store/gameStore.js';
import type { EntityId } from '../shared/types/index.js';
import type { World as WorldType } from './simulation/world/World.js';
import { World } from './simulation/world/World.js';
import { Grid } from './simulation/world/Grid.js';
import { GameLoop } from './GameLoop.js';
import { useGameStore } from '../shared/store/gameStore.js';
import type { ProgramRegistry, ProgramDef } from './programs/types.js';
import { createBase } from './simulation/entities/createBase.js';
import { createMine } from './simulation/entities/createMine.js';
import { createCharger } from './simulation/entities/createCharger.js';
import { createDrone } from './simulation/entities/createDrone.js';
import { GameRenderer } from '../renderer/GameRenderer.js';

// ─── Pure functions (exported for testing) ───────────────────────────────────

export function checkWin(
  win: WinCondition,
  world: WorldType,
  baseId: EntityId,
  stats: StatsState,
): boolean {
  switch (win.type) {
    case 'ore_mined': {
      const inv = world.getComponent(baseId, 'Inventory');
      return inv !== undefined && inv.ore >= win.target;
    }
    case 'efficiency':
      return stats.efficiency >= win.target;
  }
}

export function checkFail(fail: FailCondition, stats: StatsState): boolean {
  switch (fail.type) {
    case 'time_limit':
      return stats.tick >= fail.maxTicks;
    case 'low_throughput':
      if (stats.tick < fail.gracePeriodTicks) return false;
      return stats.orePerMin < fail.minOrePerMin;
  }
}

// ─── Scene builder ────────────────────────────────────────────────────────────

interface SceneResult {
  world: World;
  grid: Grid;
  registry: ProgramRegistry;
  baseId: EntityId;
  staticEntityIds: EntityId[];
}

function buildScene(): SceneResult {
  const world = new World();
  const grid = new Grid();
  const registry: ProgramRegistry = new Map();

  grid.setTile(1, 1, 'base');
  grid.setTile(18, 1, 'mine');
  grid.setTile(10, 10, 'mine');
  grid.setTile(1, 18, 'charger');
  grid.setTile(10, 5, 'charger');

  const baseId = createBase(world, 1, 1);
  const mine1Id = createMine(world, 18, 1);
  const mine2Id = createMine(world, 10, 10);
  const charger1Id = createCharger(world, 1, 18);
  const charger2Id = createCharger(world, 10, 5);
  const drone1Id = createDrone(world, 5, 5);
  const drone2Id = createDrone(world, 12, 12);

  const mineLoop: ProgramDef = {
    id: 'mine-loop',
    name: 'mine-loop',
    instructions: [
      { type: 'LOOP', body: [
        { type: 'MOVE_TO', targetEntityId: mine1Id },
        { type: 'MINE' },
        { type: 'MOVE_TO', targetEntityId: baseId },
        { type: 'DROP' },
        { type: 'IF', condition: { type: 'ENERGY_LOW', threshold: 30 }, then: [
          { type: 'MOVE_TO', targetEntityId: charger1Id },
          { type: 'CHARGE' },
        ]},
      ]},
    ],
  };
  registry.set(mineLoop.id, mineLoop);

  const prog1 = world.getComponent(drone1Id, 'Program')!;
  prog1.currentProgramId = mineLoop.id;
  prog1.callStack = [{ programId: mineLoop.id, instructionIndex: 0 }];
  prog1.state = 'running';

  const prog2 = world.getComponent(drone2Id, 'Program')!;
  prog2.currentProgramId = mineLoop.id;
  prog2.callStack = [{ programId: mineLoop.id, instructionIndex: 0 }];
  prog2.state = 'running';

  return {
    world,
    grid,
    registry,
    baseId,
    staticEntityIds: [baseId, mine1Id, mine2Id, charger1Id, charger2Id],
  };
}

// ─── GameController class ─────────────────────────────────────────────────────

export class GameController {
  private readonly loop = new GameLoop();
  private renderer: GameRenderer | null = null;
  private world: World | null = null;
  private baseId: EntityId | null = null;
  private _entityIds: EntityId[] = [];
  private container: HTMLElement | null = null;
  private onDroneClick: ((id: EntityId) => void) | null = null;

  constructor(private readonly config: GameConfig) {}

  get entityIds(): EntityId[] {
    return this._entityIds;
  }

  setup(container: HTMLElement, onDroneClick: (id: EntityId) => void): void {
    this.container = container;
    this.onDroneClick = onDroneClick;
    this.initWorld();
  }

  start(): void {
    const { gameStatus } = useGameStore.getState();
    if (gameStatus === 'won' || gameStatus === 'failed') return;
    this.loop.start(() => this.onTick());
    useGameStore.getState().setRunning(true);
    useGameStore.getState().setGameStatus('running');
  }

  pause(): void {
    this.loop.stop();
    useGameStore.getState().setRunning(false);
    const { gameStatus } = useGameStore.getState();
    if (gameStatus === 'running') {
      useGameStore.getState().setGameStatus('paused');
    }
  }

  step(): void {
    const { gameStatus } = useGameStore.getState();
    if (gameStatus === 'won' || gameStatus === 'failed') return;
    useGameStore.getState().tick();
    this.checkConditions();
  }

  reset(): void {
    this.loop.stop();
    useGameStore.getState().setRunning(false);
    this.initWorld();
  }

  destroy(): void {
    this.loop.stop();
    this.renderer?.destroy();
  }

  private initWorld(): void {
    const scene = buildScene();
    this.world = scene.world;
    this.baseId = scene.baseId;
    this._entityIds = scene.staticEntityIds;

    this.renderer?.destroy();
    this.renderer = new GameRenderer(
      scene.world,
      scene.grid,
      this.container!,
      this.onDroneClick ?? undefined,
    );

    const store = useGameStore.getState();
    store.init(scene.world, scene.grid, scene.registry);
    store.setGameStatus('idle');
  }

  private onTick(): void {
    useGameStore.getState().tick();
    this.checkConditions();
  }

  private checkConditions(): void {
    const store = useGameStore.getState();
    if (store.gameStatus !== 'running') return;
    if (!this.world || this.baseId === null) return;

    if (checkWin(this.config.win, this.world, this.baseId, store.stats)) {
      this.loop.stop();
      store.setRunning(false);
      store.setGameStatus('won', 'Цель достигнута!');
    } else if (checkFail(this.config.fail, store.stats)) {
      this.loop.stop();
      store.setRunning(false);
      store.setGameStatus('failed', this.getFailMessage());
    }
  }

  private getFailMessage(): string {
    switch (this.config.fail.type) {
      case 'time_limit':
        return `Время истекло (${this.config.fail.maxTicks} тиков)`;
      case 'low_throughput':
        return `Производительность слишком низкая`;
    }
  }
}
