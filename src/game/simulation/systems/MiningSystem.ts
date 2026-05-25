import type { EntityId } from '../../../shared/types/index.js';
import type { ComponentName } from '../world/World.js';
import type { World } from '../world/World.js';
import { gameEvents } from '../../../shared/events/gameEvents.js';
import { DT, EPSILON, BASE_MINE_DURATION_PER_ORE, BASE_DROP_DURATION_PER_ORE } from '../constants.js';

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
      if (program.localPaused) continue;
      if (program.state !== 'waiting' || program.waitingFor !== 'mine') continue;

      const position = this.world.getComponent(id, 'Position')!;
      const inventory = this.world.getComponent(id, 'Inventory')!;
      const energy = this.world.getComponent(id, 'Energy')!;

      const depositId = this.findEntityAt(position.x, position.y, 'Deposit');
      if (depositId === null) {
        program.mineElapsed = undefined;
        program.state = 'running';
        program.waitingFor = undefined;
        continue;
      }

      const deposit = this.world.getComponent(depositId, 'Deposit')!;

      if (deposit.oreRemaining <= 0 || inventory.ore >= inventory.capacity) {
        program.mineElapsed = undefined;
        program.state = 'running';
        program.waitingFor = undefined;
        continue;
      }

      program.mineElapsed = (program.mineElapsed ?? 0) + DT;

      if (program.mineElapsed >= BASE_MINE_DURATION_PER_ORE - EPSILON) {
        deposit.oreRemaining -= 1;
        inventory.ore += 1;
        energy.current = Math.max(0, energy.current - energy.drainPerMine);
        gameEvents.emit('ore:mined', { droneId: id, x: position.x, y: position.y });
        program.mineElapsed = undefined;
        program.state = 'running';
        program.waitingFor = undefined;
      }
    }
  }

  private processDrop(): void {
    const drones = this.world.query('Position', 'Inventory', 'Program');
    for (const id of drones) {
      const program = this.world.getComponent(id, 'Program')!;
      if (program.localPaused) continue;
      if (program.state !== 'waiting' || program.waitingFor !== 'drop') continue;

      const position = this.world.getComponent(id, 'Position')!;
      const droneInventory = this.world.getComponent(id, 'Inventory')!;

      const baseId = this.findEntityAt(position.x, position.y, 'Inventory', id);
      if (baseId === null) {
        program.dropElapsed = undefined;
        program.state = 'running';
        program.waitingFor = undefined;
        continue;
      }

      const baseInventory = this.world.getComponent(baseId, 'Inventory')!;

      program.dropElapsed = (program.dropElapsed ?? 0) + DT;

      if (program.dropElapsed >= BASE_DROP_DURATION_PER_ORE - EPSILON) {
        baseInventory.ore += 1;
        droneInventory.ore -= 1;
        gameEvents.emit('ore:dropped', { droneId: id, amount: 1 });
        program.dropElapsed = undefined;
        program.state = 'running';
        program.waitingFor = undefined;
      }
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
