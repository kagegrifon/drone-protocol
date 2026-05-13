import type { WinCondition, FailCondition } from './types.js';
import type { StatsState } from '../shared/store/gameStore.js';
import type { EntityId } from '../shared/types/index.js';
import type { World as WorldType } from './simulation/world/World.js';
import type { MissionDef, EntityMeta, EntityType } from './missions/types.js';
import type { AudioManager } from '../renderer/audio/AudioManager.js';
import { GameLoop } from './GameLoop.js';
import { useGameStore } from '../shared/store/gameStore.js';
import { GameRenderer } from '../renderer/GameRenderer.js';
import { gameEvents } from '../shared/events/gameEvents.js';

function buildEntityMetas(
  entities: Array<{ id: EntityId; type: EntityType }>
): EntityMeta[] {
  const counts: Partial<Record<EntityType, number>> = {};
  return entities.map(({ id, type }) => {
    counts[type] = (counts[type] ?? 0) + 1;
    const n = counts[type]!;
    const label =
      type === 'mine' ? `Mine ${n}` :
      type === 'charger' ? `Charger ${n}` :
      n === 1 ? 'Base' : `Base ${n}`;
    return { id, type, label };
  });
}

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

export interface GameControllerSetupOptions {
  onDroneClick: (id: EntityId) => void;
  onReady?: () => void;
  onAudioReady?: (am: AudioManager) => void;
}

export class GameController {
  private readonly loop = new GameLoop();
  private renderer: GameRenderer | null = null;
  private world: WorldType | null = null;
  private baseId: EntityId | null = null;
  private _entities: EntityMeta[] = [];
  private container: HTMLElement | null = null;
  private _setupOptions: GameControllerSetupOptions | null = null;

  constructor(private readonly mission: MissionDef) {}

  get entities(): EntityMeta[] {
    return this._entities;
  }

  setup(container: HTMLElement, options: GameControllerSetupOptions): void {
    this.container = container;
    this._setupOptions = options;
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
    gameEvents.clearAll();
  }

  private initWorld(): void {
    const scene = this.mission.buildScene();
    this.world = scene.world;
    this.baseId = scene.baseId;
    this._entities = buildEntityMetas(scene.staticEntities);

    this.renderer?.destroy();
    gameEvents.clearAll();
    this.renderer = new GameRenderer(
      scene.world,
      scene.grid,
      this.container!,
      {
        onDroneClick: this._setupOptions?.onDroneClick,
        onReady: this._setupOptions?.onReady,
        onAudioReady: this._setupOptions?.onAudioReady,
      },
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
      gameEvents.emit('mission:complete', undefined);
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
