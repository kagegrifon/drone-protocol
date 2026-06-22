import type { World } from "../world/World.js";
import { gameEvents } from "../../../shared/events/gameEvents.js";
import { DT, EPSILON } from "../constants.js";

export class MovementSystem {
  constructor(private readonly world: World) {}

  update(): void {
    const drones = this.world.query(
      "Position",
      "Movement",
      "Energy",
      "Program",
    );

    // Build stepped-set: cells occupied at the start of this tick
    const stepped = new Set<string>();
    for (const id of drones) {
      const pos = this.world.getComponent(id, "Position")!;
      stepped.add(`${pos.x},${pos.y}`);
    }

    for (const id of drones) {
      const movement = this.world.getComponent(id, "Movement")!;
      const position = this.world.getComponent(id, "Position")!;
      const energy = this.world.getComponent(id, "Energy")!;
      const program = this.world.getComponent(id, "Program")!;

      if (program.localPaused) continue;

      if (movement.path.length === 0) {
        if (program.state === "move") {
          movement.progress = 0;
          program.state = "running";
        }
        continue;
      }

      movement.progress += DT * movement.speed;
      if (movement.progress < 1 - EPSILON) continue;

      const next = movement.path[0];
      const fromKey = `${position.x},${position.y}`;
      const toKey = `${next.x},${next.y}`;

      // Block if another drone already stepped into target cell this tick
      if (toKey !== fromKey && stepped.has(toKey)) {
        movement.path = [];
        movement.progress = 0;
        if (program.state === "move") {
          program.state = "running";
        }
        gameEvents.emit("drone:blocked", { droneId: id });
        continue;
      }

      // Execute step — keep remaining path so drone continues without pausing
      movement.path.shift();
      stepped.delete(fromKey);
      stepped.add(toKey);

      const fromX = position.x;
      const fromY = position.y;
      position.x = next.x;
      position.y = next.y;
      energy.current = Math.max(0, energy.current - energy.drainPerMove);
      movement.progress = 0;

      // Continuous movement: если driver успел дописать следующий шаг (look-ahead),
      // path не пуст — продолжаем движение, state остаётся move. Если path пуст —
      // известный путь исчерпан, возвращаем управление программе (безопасная
      // остановка на клетке). См. спек continuous-drone-movement.
      if (program.state === "move" && movement.path.length === 0) {
        program.state = "running";
      }

      gameEvents.emit("drone:moved", {
        droneId: id,
        fromX,
        fromY,
        toX: next.x,
        toY: next.y,
      });
    }
  }
}
