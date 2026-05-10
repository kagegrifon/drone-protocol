import type { EntityId } from '../../../shared/types/index.js';
import type { World } from '../world/World.js';
import { gameEvents } from '../../../shared/events/gameEvents.js';

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

      const chargerId = this.findChargerAt(position.x, position.y);
      if (chargerId === null) continue;

      if (energy.current < energy.max) {
        const charger = this.world.getComponent(chargerId, 'ChargerStation')!;
        energy.current = Math.min(energy.max, energy.current + charger.chargeRate);
      }

      if (program.state === 'waiting' && program.waitingFor === 'charge') {
        nowCharging.add(id);
        if (energy.current >= energy.max) {
          program.state = 'running';
          program.waitingFor = undefined;
        }
      }
    }

    // Emit charge:started / charge:completed transitions
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
