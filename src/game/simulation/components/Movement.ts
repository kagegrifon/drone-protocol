import type { Position } from "../../../shared/types/index.js";

export interface MovementComponent {
  targetX: number;
  targetY: number;
  path: Position[];
  progress: number;
  speed: number; // клеток в секунду
  /**
   * Клетка, в которую дрон сейчас физически едет (progress 0→1). Резервируется
   * при выезде и держится до прибытия, чтобы другие дроны не начинали движение
   * в ту же клетку. null — дрон стоит (progress === 0, движение не начато).
   */
  reserved?: Position | null;
}
