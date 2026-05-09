export type GameStatus = 'idle' | 'running' | 'paused' | 'won' | 'failed';

export type WinCondition =
  | { type: 'ore_mined'; target: number }
  | { type: 'efficiency'; target: number };

export type FailCondition =
  | { type: 'time_limit'; maxTicks: number }
  | { type: 'low_throughput'; minOrePerMin: number; gracePeriodTicks: number };

export interface GameConfig {
  win: WinCondition;
  fail: FailCondition;
}
