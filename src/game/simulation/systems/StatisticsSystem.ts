import type { World } from '../world/World.js';
import { gameEvents, type GameEventMap } from '../../../shared/events/gameEvents.js';
import { DT } from '../constants.js';

export interface StatisticsState {
  oreMined: number;
  orePerMinute: number;
  idleDroneCount: number;
  totalDrones: number;
  efficiency: number;
  congestionEvents: number;
}

const WINDOW_TICKS = Math.round(60 / DT); // 60-second rolling window

export class StatisticsSystem {
  readonly stats: StatisticsState = {
    oreMined: 0,
    orePerMinute: 0,
    idleDroneCount: 0,
    totalDrones: 0,
    efficiency: 0,
    congestionEvents: 0,
  };

  private oreThisTick = 0;
  private oreHistory: number[] = [];

  private readonly _onOreDropped: (data: GameEventMap['ore:dropped']) => void;

  constructor(private readonly world: World) {
    this._onOreDropped = ({ amount }) => this.recordOreMined(amount);
    gameEvents.on('ore:dropped', this._onOreDropped);
  }

  destroy(): void {
    gameEvents.off('ore:dropped', this._onOreDropped);
  }

  recordOreMined(amount: number): void {
    this.oreThisTick += amount;
    this.stats.oreMined += amount;
  }

  recordCongestion(): void {
    this.stats.congestionEvents++;
  }

  update(): void {
    this.oreHistory.push(this.oreThisTick);
    this.oreThisTick = 0;

    if (this.oreHistory.length > WINDOW_TICKS) {
      this.oreHistory.shift();
    }

    const totalOreInWindow = this.oreHistory.reduce((a, b) => a + b, 0);
    const elapsedSeconds = this.oreHistory.length * DT;
    this.stats.orePerMinute = elapsedSeconds > 0 ? (totalOreInWindow / elapsedSeconds) * 60 : 0;

    const drones = this.world.query('Position', 'Program');
    let idle = 0;
    for (const id of drones) {
      const program = this.world.getComponent(id, 'Program')!;
      if (program.state === 'idle') idle++;
    }
    this.stats.idleDroneCount = idle;
    this.stats.totalDrones = drones.length;
    this.stats.efficiency = drones.length > 0 ? (drones.length - idle) / drones.length : 0;
  }
}
