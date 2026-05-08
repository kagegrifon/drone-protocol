import type { EntityId } from '../../../shared/types/index.js';
import type { PositionComponent } from '../components/Position.js';
import type { EnergyComponent } from '../components/Energy.js';
import type { InventoryComponent } from '../components/Inventory.js';
import type { ProgramComponent } from '../components/Program.js';
import type { MovementComponent } from '../components/Movement.js';
import type { RenderableComponent } from '../components/Renderable.js';
import type { DepositComponent } from '../components/Deposit.js';
import type { ChargerStationComponent } from '../components/ChargerStation.js';

export interface ComponentMap {
  Position: PositionComponent;
  Energy: EnergyComponent;
  Inventory: InventoryComponent;
  Program: ProgramComponent;
  Movement: MovementComponent;
  Renderable: RenderableComponent;
  Deposit: DepositComponent;
  ChargerStation: ChargerStationComponent;
}

export type ComponentName = keyof ComponentMap;

export class World {
  private nextEntityId: EntityId = 1;
  private components: Map<EntityId, Map<ComponentName, ComponentMap[ComponentName]>> = new Map();
  private index: Map<ComponentName, Set<EntityId>> = new Map();

  createEntity(): EntityId {
    const id = this.nextEntityId++;
    this.components.set(id, new Map());
    return id;
  }

  destroyEntity(entity: EntityId): void {
    const entityComponents = this.components.get(entity);
    if (!entityComponents) return;
    for (const name of entityComponents.keys()) {
      this.index.get(name)?.delete(entity);
    }
    this.components.delete(entity);
  }

  addComponent<K extends ComponentName>(entity: EntityId, name: K, data: ComponentMap[K]): void {
    const entityComponents = this.components.get(entity);
    if (!entityComponents) throw new Error(`Entity ${entity} does not exist`);
    entityComponents.set(name, data);
    if (!this.index.has(name)) this.index.set(name, new Set());
    this.index.get(name)!.add(entity);
  }

  removeComponent<K extends ComponentName>(entity: EntityId, name: K): void {
    this.components.get(entity)?.delete(name);
    this.index.get(name)?.delete(entity);
  }

  getComponent<K extends ComponentName>(entity: EntityId, name: K): ComponentMap[K] | undefined {
    return this.components.get(entity)?.get(name) as ComponentMap[K] | undefined;
  }

  hasComponent<K extends ComponentName>(entity: EntityId, name: K): boolean {
    return this.components.get(entity)?.has(name) ?? false;
  }

  query(...names: ComponentName[]): EntityId[] {
    if (names.length === 0) return [];
    const [first, ...rest] = names;
    const candidates = this.index.get(first);
    if (!candidates) return [];
    const result: EntityId[] = [];
    for (const entity of candidates) {
      if (rest.every((n) => this.index.get(n)?.has(entity))) {
        result.push(entity);
      }
    }
    return result;
  }
}
