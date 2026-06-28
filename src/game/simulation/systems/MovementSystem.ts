import type { Position } from "../../../shared/types/index.js";
import type { World } from "../world/World.js";
import { gameEvents } from "../../../shared/events/gameEvents.js";
import { DT, EPSILON } from "../constants.js";
import { getMoveSpeedMul } from "../modifiers/effects.js";

const posKey = (x: number, y: number) => `${x},${y}`;

export class MovementSystem {
  constructor(private readonly world: World) {}

  update(): void {
    const drones = this.world.query(
      "Position",
      "Movement",
      "Energy",
      "Program",
    );

    // ── Снимок занятости на начало тика ───────────────────────────────────
    // Клетка занята, если в ней стоит дрон ИЛИ она зарезервирована дроном,
    // который уже едет в неё (progress > 0). Резервирование держится всё
    // время поездки (progress 0→1) — так встречный дрон при ВЫЕЗДЕ (progress
    // === 0) видит цель занятой и не начинает движение, вместо того чтобы
    // копить progress впустую и потом быть отброшенным назад.
    const occupied = new Set<string>();
    // Куда едет каждый движущийся дрон — для запрета встречного обмена (swap).
    const movingTargetByFrom = new Map<string, Position>();

    for (const id of drones) {
      const position = this.world.getComponent(id, "Position")!;
      const movement = this.world.getComponent(id, "Movement")!;
      occupied.add(posKey(position.x, position.y));
      if (movement.progress > 0 && movement.reserved) {
        occupied.add(posKey(movement.reserved.x, movement.reserved.y));
        movingTargetByFrom.set(
          posKey(position.x, position.y),
          movement.reserved,
        );
      }
    }

    for (const id of drones) {
      const movement = this.world.getComponent(id, "Movement")!;
      const position = this.world.getComponent(id, "Position")!;
      const energy = this.world.getComponent(id, "Energy")!;
      const program = this.world.getComponent(id, "Program")!;
      const mods = this.world.getComponent(id, "Modifiers");
      const activeModifiers = mods?.active ?? [];

      if (program.localPaused) continue;

      if (movement.path.length === 0) {
        if (program.state === "move") {
          movement.progress = 0;
          movement.reserved = null;
          program.state = "running";
        }
        continue;
      }

      const next = movement.path[0];
      const fromKey = posKey(position.x, position.y);
      const toKey = posKey(next.x, next.y);
      // ── Выезд: дрон стоит (progress === 0), решает, можно ли тронуться ──
      if (movement.progress === 0) {
        // Шаг в собственную клетку — вырожденный путь, разрешаем сразу ниже.
        if (toKey !== fromKey) {
          // Цель занята/зарезервирована другим дроном — стоим и ждём.
          if (occupied.has(toKey)) continue;

          // Swap: встречный дрон в целевой клетке едет в нашу — запрещаем.
          const oncoming = movingTargetByFrom.get(toKey);
          if (oncoming && posKey(oncoming.x, oncoming.y) === fromKey) continue;

          // Резервируем целевую клетку на всё время поездки.
          movement.reserved = { x: next.x, y: next.y };
          occupied.add(toKey);
          movingTargetByFrom.set(fromKey, movement.reserved);
        }
      }

      // ── Накопление прогресса (плавность) ──────────────────────────────────
      movement.progress += DT * movement.speed * getMoveSpeedMul(activeModifiers);
      if (movement.progress < 1 - EPSILON) continue;

      // ── Прибытие ──────────────────────────────────────────────────────────
      movement.path.shift();
      const fromX = position.x;
      const fromY = position.y;
      position.x = next.x;
      position.y = next.y;
      energy.current = Math.max(0, energy.current - energy.drainPerMove);
      movement.progress = 0;
      movement.reserved = null;

      if (program.state === "move") {
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
