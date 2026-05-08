import type { EntityId } from '../../../shared/types/index.js';
import type { World } from '../world/World.js';

export class EnergySystem {
  constructor(private readonly world: World) {}

  update(): void {
    const drones = this.world.query('Position', 'Energy', 'Program');
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

      if (energy.current >= energy.max && program.state === 'waiting' && program.waitingFor === 'charge') {
        program.state = 'running';
        program.waitingFor = undefined;
      }
    }
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
