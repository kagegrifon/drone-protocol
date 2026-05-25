import type { EntityId } from '../../../shared/types/index.js';
import type { World } from '../world/World.js';
import { gameEvents } from '../../../shared/events/gameEvents.js';
import { DT, EPSILON, BASE_CHARGE_DURATION_PER_UNIT } from '../constants.js';

export class EnergySystem {
  private _charging = new Set<EntityId>();

  constructor(private readonly world: World) {}

  update(): void {
    const drones = this.world.query('Position', 'Energy', 'Program');
    const nowCharging = new Set<EntityId>();

    for (const id of drones) {
      const energy = this.world.getComponent(id, 'Energy')!;
      const position = this.world.getComponent(id, 'Position')!;
      const program = this.world.getComponent(id, 'Program')!;

      if (program.localPaused) continue;

      const isActiveCharge = program.state === 'waiting' && program.waitingFor === 'charge';

      const chargerId = this.findChargerAt(position.x, position.y);
      if (chargerId === null) {
        // Не на станции: активная CHARGE завершается сразу, ничего больше не делаем.
        if (isActiveCharge) {
          program.chargeElapsed = undefined;
          program.state = 'running';
          program.waitingFor = undefined;
        }
        continue;
      }

      // На станции и уже полная энергия — активная CHARGE завершается сразу.
      if (isActiveCharge && energy.current >= energy.max) {
        program.chargeElapsed = undefined;
        program.state = 'running';
        program.waitingFor = undefined;
        continue;
      }

      if (energy.current < energy.max) {
        program.chargeElapsed = (program.chargeElapsed ?? 0) + DT;
        // Пассивная зарядка: while-цикл сохранён, чтобы поведение станции не менялось.
        while (program.chargeElapsed >= BASE_CHARGE_DURATION_PER_UNIT - EPSILON && energy.current < energy.max) {
          energy.current = Math.min(energy.max, energy.current + 1);
          program.chargeElapsed -= BASE_CHARGE_DURATION_PER_UNIT;
          // Активная CHARGE: после первой выданной единицы — выход.
          if (isActiveCharge) {
            program.chargeElapsed = undefined;
            program.state = 'running';
            program.waitingFor = undefined;
            break;
          }
        }
      }

      if (isActiveCharge && program.waitingFor === 'charge') {
        nowCharging.add(id);
      }
    }

    for (const id of nowCharging) {
      if (!this._charging.has(id)) gameEvents.emit('charge:started', { droneId: id });
    }
    for (const id of this._charging) {
      if (!nowCharging.has(id)) gameEvents.emit('charge:completed', { droneId: id });
    }
    this._charging = nowCharging;
  }

  private findChargerAt(x: number, y: number): EntityId | null {
    const chargers = this.world.query('Position', 'ChargerStation');
    for (const cid of chargers) {
      const pos = this.world.getComponent(cid, 'Position')!;
      if (pos.x === x && pos.y === y) return cid;
    }
    return null;
  }
}
