import type { EntityId } from '../../../shared/types/index.js';
import type { ComponentName } from '../world/World.js';
import type { World } from '../world/World.js';
import { gameEvents } from '../../../shared/events/gameEvents.js';

export class MiningSystem {
  constructor(private readonly world: World) {}

  update(): void {
    this.processMining();
    this.processDrop();
  }

  private processMining(): void {
    const drones = this.world.query('Position', 'Inventory', 'Energy', 'Program');
    for (const id of drones) {
      const program = this.world.getComponent(id, 'Program')!;
      if (program.state !== 'waiting' || program.waitingFor !== 'mine') continue;

      const position = this.world.getComponent(id, 'Position')!;
      const inventory = this.world.getComponent(id, 'Inventory')!;
      const energy = this.world.getComponent(id, 'Energy')!;

      const depositId = this.findEntityAt(position.x, position.y, 'Deposit');
      if (depositId === null) {
        program.state = 'running';
        program.waitingFor = undefined;
        continue;
      }

      const deposit = this.world.getComponent(depositId, 'Deposit')!;
      if (deposit.oreRemaining <= 0 || inventory.ore >= inventory.capacity) {
        program.state = 'running';
        program.waitingFor = undefined;
        continue;
      }

      const amount = Math.min(deposit.mineRate, deposit.oreRemaining, inventory.capacity - inventory.ore);
      deposit.oreRemaining -= amount;
      inventory.ore += amount;
      energy.current = Math.max(0, energy.current - energy.drainPerMine);
      gameEvents.emit('ore:mined', { droneId: id, x: position.x, y: position.y });
    }
  }

  private processDrop(): void {
    const drones = this.world.query('Position', 'Inventory', 'Program');
    for (const id of drones) {
      const program = this.world.getComponent(id, 'Program')!;
      if (program.state !== 'waiting' || program.waitingFor !== 'drop') continue;

      const position = this.world.getComponent(id, 'Position')!;
      const droneInventory = this.world.getComponent(id, 'Inventory')!;

      const baseId = this.findEntityAt(position.x, position.y, 'Inventory', id);
      if (baseId !== null) {
        const baseInventory = this.world.getComponent(baseId, 'Inventory')!;
        const amount = droneInventory.ore;
        baseInventory.ore += amount;
        droneInventory.ore = 0;
        gameEvents.emit('ore:dropped', { droneId: id, amount });
      }

      program.state = 'running';
      program.waitingFor = undefined;
    }
  }

  private findEntityAt(x: number, y: number, component: ComponentName, excludeId?: EntityId): EntityId | null {
    const entities = this.world.query('Position', component);
    for (const eid of entities) {
      if (excludeId !== undefined && eid === excludeId) continue;
      const pos = this.world.getComponent(eid, 'Position')!;
      if (pos.x === x && pos.y === y) return eid;
    }
    return null;
  }
}
