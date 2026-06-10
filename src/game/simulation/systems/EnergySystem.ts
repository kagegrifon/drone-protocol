import type { EntityId } from "../../../shared/types/index.js";
import type { World } from "../world/World.js";
import { gameEvents } from "../../../shared/events/gameEvents.js";
import { DT, EPSILON, BASE_CHARGE_SPEED } from "../constants.js";

export class EnergySystem {
  private _charging = new Set<EntityId>();

  constructor(private readonly world: World) {}

  update(): void {
    const drones = this.world.query("Position", "Energy", "Program");
    const nowCharging = new Set<EntityId>();

    for (const id of drones) {
      const energy = this.world.getComponent(id, "Energy")!;
      const position = this.world.getComponent(id, "Position")!;
      const program = this.world.getComponent(id, "Program")!;

      if (program.localPaused) continue;

      const isActiveCharge = program.state === "charge";

      const chargerId = this.findChargerAt(position.x, position.y);
      if (chargerId === null) {
        // Не на станции: активная CHARGE завершается сразу, ничего больше не делаем.
        if (isActiveCharge) {
          program.chargeProgress = undefined;
          program.state = "running";
        }
        continue;
      }

      // На станции и уже полная энергия — активная CHARGE завершается сразу.
      if (isActiveCharge && energy.current >= energy.max) {
        program.chargeProgress = undefined;
        program.state = "running";
        continue;
      }

      if (energy.current < energy.max) {
        program.chargeProgress =
          (program.chargeProgress ?? 0) + BASE_CHARGE_SPEED * DT;
        // Пассивная зарядка: while-цикл сохранён, чтобы поведение станции не менялось.
        while (
          program.chargeProgress >= 1 - EPSILON &&
          energy.current < energy.max
        ) {
          energy.current = Math.min(energy.max, energy.current + 1);
          program.chargeProgress -= 1;
          // Активная CHARGE: после первой выданной единицы — выход.
          if (isActiveCharge) {
            program.chargeProgress = undefined;
            program.state = "running";
            break;
          }
        }
      }

      if (program.state === "charge") {
        nowCharging.add(id);
      }
    }

    for (const id of nowCharging) {
      if (!this._charging.has(id))
        gameEvents.emit("charge:started", { droneId: id });
    }
    for (const id of this._charging) {
      if (!nowCharging.has(id))
        gameEvents.emit("charge:completed", { droneId: id });
    }
    this._charging = nowCharging;
  }

  private findChargerAt(x: number, y: number): EntityId | null {
    const chargers = this.world.query("Position", "ChargerStation");
    for (const cid of chargers) {
      const pos = this.world.getComponent(cid, "Position")!;
      if (pos.x === x && pos.y === y) return cid;
    }
    return null;
  }
}
