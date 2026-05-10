import type { WinCondition, FailCondition } from './types.js';
import type { StatsState } from '../shared/store/gameStore.js';
import type { EntityId } from '../shared/types/index.js';
import type { World as WorldType } from './simulation/world/World.js';
import type { MissionDef } from './missions/types.js';
import { GameLoop } from './GameLoop.js';
import { useGameStore } from '../shared/store/gameStore.js';
import { GameRenderer } from '../renderer/GameRenderer.js';

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
    case 'ore_per_min':
      return stats.orePerMin >= win.target;
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

export class GameController {
  private readonly loop = new GameLoop();
  private renderer: GameRenderer | null = null;
  private world: WorldType | null = null;
  private baseId: EntityId | null = null;
  private _entityIds: EntityId[] = [];
  private container: HTMLElement | null = null;
  private onDroneClick: ((id: EntityId) => void) | null = null;

  constructor(private readonly mission: MissionDef) {}

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
    const scene = this.mission.buildScene();
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

    if (checkWin(this.mission.config.win, this.world, this.baseId, store.stats)) {
      this.loop.stop();
      store.setRunning(false);
      store.setGameStatus('won', 'Цель достигнута!');
    } else if (checkFail(this.mission.config.fail, store.stats)) {
      this.loop.stop();
      store.setRunning(false);
      store.setGameStatus('failed', this.getFailMessage());
    }
  }

  private getFailMessage(): string {
    switch (this.mission.config.fail.type) {
      case 'time_limit':
        return `Время истекло (${this.mission.config.fail.maxTicks} тиков)`;
      case 'low_throughput':
        return `Производительность слишком низкая`;
    }
  }
}
