import type { WinCondition, FailCondition } from "./types.js";
import type { StatsState } from "../shared/store/gameStore.js";
import type { EntityId } from "../shared/types/index.js";
import type { World as WorldType } from "./simulation/world/World.js";
import type { MissionDef, EntityMeta } from "./missions/types.js";
import type { WorldObjectType } from "../shared/types/index.js";
import type { AudioManager } from "../renderer/audio/AudioManager.js";
import { GameLoop } from "./GameLoop.js";
import { useGameStore } from "../shared/store/gameStore.js";
import { GameRenderer } from "../renderer/GameRenderer.js";
import { gameEvents } from "../shared/events/gameEvents.js";

/** Защитный лимит: сколько тиков максимум проматывает один Step action. */
const MAX_STEP_TICKS = 600;

const ENTITY_LABEL: Record<WorldObjectType, string> = {
  mine: "Mine",
  charger: "Charger",
  base: "Base",
};

function buildEntityMetas(
  entities: Array<{ id: EntityId; type: WorldObjectType }>,
): EntityMeta[] {
  const counts: Partial<Record<WorldObjectType, number>> = {};
  return entities.map(({ id, type }) => {
    counts[type] = (counts[type] ?? 0) + 1;
    const n = counts[type]!;
    const label = `${ENTITY_LABEL[type]} ${n}`;
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
    case "ore_mined": {
      const inv = world.getComponent(baseId, "Inventory");
      return inv !== undefined && inv.ore >= win.target;
    }
    case "efficiency":
      return stats.efficiency >= win.target;
    case "ore_per_min":
      return stats.orePerMin >= win.target;
  }
}

export function checkFail(fail: FailCondition, stats: StatsState): boolean {
  switch (fail.type) {
    case "time_limit":
      return stats.tick >= fail.maxTicks;
    case "low_throughput":
      if (stats.tick < fail.gracePeriodTicks) return false;
      return stats.orePerMin < fail.minOrePerMin;
  }
}

export interface GameControllerSetupOptions {
  onDroneClick: (id: EntityId) => void;
  onCellClick?: (cell: { x: number; y: number }) => void;
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
    if (gameStatus === "won" || gameStatus === "failed") return;
    this.loop.start(() => this.onTick());
    useGameStore.getState().setRunning(true);
    useGameStore.getState().setGameStatus("running");
  }

  pause(): void {
    this.loop.stop();
    useGameStore.getState().setRunning(false);
    const { gameStatus } = useGameStore.getState();
    if (gameStatus === "running") {
      useGameStore.getState().setGameStatus("paused");
    }
  }

  step(): void {
    const { gameStatus } = useGameStore.getState();
    if (gameStatus === "won" || gameStatus === "failed") return;
    useGameStore.getState().tick();
    this.checkConditions();
  }

  /**
   * Прогоняет тики до тех пор, пока CodeBehaviorDriver не отправит воркеру
   * 'resume' для выбранного дрона — это момент, когда await self.* в коде
   * дрона реально резолвится и код продолжает исполняться (см.
   * gameEvents "drone:actionResumed" в CodeBehaviorDriver.step) — либо до
   * MAX_STEP_TICKS. No-op на won/failed.
   *
   * Раньше «действие сменилось» детектировалось по program.state/currentLine
   * до/после всего цикла. При moveTo это ловушка: await self.moveTo(point)
   * — одно действие в коде дрона, физически растянутое на много тиков
   * (continuous movement перепланирует путь на каждом шаге и driver сразу
   * шлёт resume, а код тут же снова awaitит тот же moveTo) — currentLine не
   * менялся, и цикл докручивал тики до конца всего маршрута.
   */
  stepDroneAction(droneId: EntityId): void {
    const { gameStatus } = useGameStore.getState();
    if (gameStatus === "won" || gameStatus === "failed") return;

    let resumed = false;
    const onResumed = (data: { droneId: EntityId }) => {
      if (data.droneId === droneId) resumed = true;
    };
    gameEvents.on("drone:actionResumed", onResumed);
    try {
      for (let tickCount = 0; tickCount < MAX_STEP_TICKS && !resumed; tickCount++) {
        useGameStore.getState().tick();
      }
    } finally {
      gameEvents.off("drone:actionResumed", onResumed);
    }
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
    this.renderer = new GameRenderer(scene.world, scene.grid, this.container!, {
      onDroneClick: this._setupOptions?.onDroneClick,
      onCellClick: this._setupOptions?.onCellClick,
      onReady: this._setupOptions?.onReady,
      onAudioReady: this._setupOptions?.onAudioReady,
      focusPoint: scene.focusPoint,
    });

    const store = useGameStore.getState();
    store.init(scene.world, scene.grid, scene.registry, {
      staticEntities: scene.staticEntities,
    });
    store.setGameStatus("idle");
  }

  private onTick(): void {
    useGameStore.getState().tick();
    this.checkConditions();
  }

  private checkConditions(): void {
    const store = useGameStore.getState();
    if (store.gameStatus !== "running") return;
    if (!this.world || this.baseId === null) return;

    if (
      checkWin(this.mission.config.win, this.world, this.baseId, store.stats)
    ) {
      this.loop.stop();
      store.setRunning(false);
      store.setGameStatus("won", "Цель достигнута!");
      gameEvents.emit("mission:complete", undefined);
    } else if (
      this.mission.config.fail &&
      checkFail(this.mission.config.fail, store.stats)
    ) {
      this.loop.stop();
      store.setRunning(false);
      store.setGameStatus("failed", this.getFailMessage());
    }
  }

  private getFailMessage(): string {
    if (!this.mission.config.fail) throw new Error("Нет условия для проигрыша");

    switch (this.mission.config.fail.type) {
      case "time_limit":
        return `Время истекло (${this.mission.config.fail.maxTicks} тиков)`;
      case "low_throughput":
        return `Производительность слишком низкая`;
    }
  }
}
