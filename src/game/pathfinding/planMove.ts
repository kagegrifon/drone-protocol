import type { EntityId, Position } from "../../shared/types/index.js";
import type { World } from "../simulation/world/World.js";
import type { Grid } from "../simulation/world/Grid.js";
import { astar } from "./astar.js";

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

/**
 * Пересчитывает хвост пути от path[0] к цели (буфер пути для continuous-
 * движения). path[0] — клетка, в которую дрон уже физически едет с накопленным
 * progress; её и progress НЕ трогаем (нет рывка). A* считается ОТ path[0] к
 * цели, результат склеивается: path = [path[0], ...newTail]. При той же цели
 * путь остаётся идентичным; при смене направления хвост перестраивается со
 * следующей клетки. Если буфер пуст — планируем от позиции дрона (cold-start),
 * progress не сбрасываем. Используется, когда воркер прислал moveTo, а
 * дрон должен продолжать движение без паузы.
 */
export function extendPathTail(
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

  if (movement.path.length > 0) {
    const head = movement.path[0];
    const tail = astar(grid, head, target, occupied);
    // null → недостижимо: не обрываем текущее движение, path как есть.
    if (tail !== null) {
      movement.path = [head, ...tail];
    }
  } else {
    const path = astar(grid, dronePos, target, occupied);
    if (path !== null) {
      movement.path = path;
    }
  }
}
