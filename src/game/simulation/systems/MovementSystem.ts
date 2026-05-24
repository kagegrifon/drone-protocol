import type { World } from '../world/World.js';
import { DT, EPSILON } from '../constants.js';

export class MovementSystem {
  constructor(private readonly world: World) {}

  update(): void {
    const drones = this.world.query('Position', 'Movement', 'Energy', 'Program');
    for (const id of drones) {
      const movement = this.world.getComponent(id, 'Movement')!;
      if (movement.path.length === 0) continue;

      const position = this.world.getComponent(id, 'Position')!;
      const energy = this.world.getComponent(id, 'Energy')!;
      const program = this.world.getComponent(id, 'Program')!;

      movement.progress += DT * movement.speed;

      while (movement.progress >= 1 - EPSILON && movement.path.length > 0) {
        const next = movement.path.shift()!;
        position.x = next.x;
        position.y = next.y;
        energy.current = Math.max(0, energy.current - energy.drainPerMove);
        movement.progress -= 1;
      }

      if (movement.path.length === 0) {
        movement.progress = 0;
        if (program.state === 'waiting' && program.waitingFor === 'move') {
          program.state = 'running';
          program.waitingFor = undefined;
        }
      }
    }
  }
}
