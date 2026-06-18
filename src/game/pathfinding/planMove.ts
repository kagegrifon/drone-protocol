import type { EntityId } from "../../shared/types/index.js";
import type { World } from "../simulation/world/World.js";
import type { Grid } from "../simulation/world/Grid.js";
import { astar } from "./astar.js";

/**
 * Прокладывает A*-путь дрона до целевой сущности и записывает его в Movement.
 * Используется CodeBehaviorDriver для drone.moveTo().
 */
export function planAstarMove(
  droneId: EntityId,
  targetEntityId: EntityId,
  world: World,
  grid: Grid,
  occupied: Set<string>,
): void {
  const dronePos = world.getComponent(droneId, "Position");
  const targetPos = world.getComponent(targetEntityId, "Position");
  if (!dronePos || !targetPos) return;
  const path = astar(grid, dronePos, targetPos, occupied);
  const movement = world.getComponent(droneId, "Movement");
  if (movement && path !== null) {
    movement.path = path;
    movement.targetX = targetPos.x;
    movement.targetY = targetPos.y;
    movement.progress = 0;
  }
}
