import type { EntityId, Position } from "../../shared/types/index.js";
import type { World } from "../simulation/world/World.js";
import type { Grid } from "../simulation/world/Grid.js";
import { astar } from "./astar.js";

/**
 * Планирует РОВНО следующий 1 шаг дрона к точке (look-ahead). В отличие от
 * planMoveToPoint НЕ сбрасывает progress — используется для непрерывного
 * движения, когда цель не меняется и дрон продолжает идти без остановки.
 */
export function planNextStep(
  droneId: EntityId,
  target: Position,
  world: World,
  grid: Grid,
  occupied: Set<string>,
): void {
  const dronePos = world.getComponent(droneId, "Position");
  const movement = world.getComponent(droneId, "Movement");
  if (!dronePos || !movement) return;
  movement.targetX = target.x;
  movement.targetY = target.y;
  const path = astar(grid, dronePos, target, occupied);
  // astar возвращает путь без стартовой клетки; [] если уже на цели; null если не найден.
  movement.path = path && path.length > 0 ? [path[0]] : [];
}

/**
 * Прокладывает A*-путь дрона до точки {x, y} и записывает его в Movement.
 * Используется CodeBehaviorDriver для self.moveTo(point).
 */
export function planMoveToPoint(
  droneId: EntityId,
  point: Position,
  world: World,
  grid: Grid,
  occupied: Set<string>,
): void {
  const dronePos = world.getComponent(droneId, "Position");
  if (!dronePos) return;
  const path = astar(grid, dronePos, point, occupied);
  const movement = world.getComponent(droneId, "Movement");
  if (movement && path !== null) {
    movement.path = path;
    movement.targetX = point.x;
    movement.targetY = point.y;
    movement.progress = 0;
  }
}
