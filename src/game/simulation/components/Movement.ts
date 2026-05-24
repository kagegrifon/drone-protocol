import type { Position } from '../../../shared/types/index.js';

export interface MovementComponent {
  targetX: number;
  targetY: number;
  path: Position[];
  progress: number;
  speed: number; // клеток в секунду
}
