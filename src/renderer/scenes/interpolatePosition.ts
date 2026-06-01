import { DT } from '../../game/simulation/constants.js';

export interface Cell {
  x: number;
  y: number;
}

/**
 * Визуальная позиция дрона в пикселях с плавной интерполяцией.
 *
 * Симуляция дискретна: дрон копит `progress` (0→1) вдоль текущего шага
 * (из `from` в `to`), стоя в исходной клетке, и телепортируется в `to`,
 * когда progress достигает 1. Чтобы получить гладкое движение:
 *  - интерполируем позицию по `progress` между центрами клеток;
 *  - доинтерполируем внутри симуляционного тика по доле кадра `t`
 *    (`t` ∈ [0,1] — сколько времени прошло с начала текущего тика),
 *    добавляя прирост, который симуляция начислит за этот тик: DT*speed.
 *
 * @param from   исходная клетка (текущая Position дрона)
 * @param to     целевая клетка (path[0]) или null, если пути нет
 * @param progress накопленный прогресс шага из симуляции (0..1)
 * @param speed  скорость дрона (клеток/сек)
 * @param t      доля текущего симуляционного тика (0..1)
 * @param tileSize размер клетки в пикселях
 */
export function interpolateVisualPos(
  from: Cell,
  to: Cell | null,
  progress: number,
  speed: number,
  t: number,
  tileSize: number,
): { x: number; y: number } {
  const half = tileSize / 2;
  const fromX = from.x * tileSize + half;
  const fromY = from.y * tileSize + half;

  if (!to) {
    return { x: fromX, y: fromY };
  }

  const toX = to.x * tileSize + half;
  const toY = to.y * tileSize + half;

  // Прирост прогресса, который симуляция начислит за полный тик: progress += DT*speed.
  // t — доля этого тика, уже прошедшая между симуляционными апдейтами.
  const eff = Math.min(1, progress + t * DT * speed);

  return {
    x: fromX + (toX - fromX) * eff,
    y: fromY + (toY - fromY) * eff,
  };
}
