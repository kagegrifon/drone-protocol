import type { World } from '../world/World.js';

/**
 * CollisionSystem — снимает snapshot целочисленных позиций всех дронов.
 * Вызывается первым в порядке систем, до ProgramExecutionSystem.
 * Результат (occupied) передаётся в A* для обхода занятых клеток.
 */
export class CollisionSystem {
  readonly occupied: Set<string> = new Set();

  constructor(private readonly world: World) {}

  update(): void {
    this.occupied.clear();
    const drones = this.world.query('Position', 'Movement');
    for (const id of drones) {
      const pos = this.world.getComponent(id, 'Position')!;
      this.occupied.add(`${pos.x},${pos.y}`);
    }
  }
}
