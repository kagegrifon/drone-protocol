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
