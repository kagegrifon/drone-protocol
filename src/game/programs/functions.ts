import type { EntityId } from '../../shared/types/index.js';
import type { World } from '../simulation/world/World.js';
import type { FunctionName, ObjectRef, FunctionCall } from './types.js';

export interface FunctionSpec {
  name: FunctionName;
  label: string;
  icon: string;
  arity: 1 | 2;
  argLabels: string[];
  argFilter?: (entityId: EntityId, world: World) => boolean;
  evaluate: (resolved: EntityId[], droneId: EntityId, world: World) => number | null;
}

export function resolveObjectRef(ref: ObjectRef, droneId: EntityId): EntityId {
  return ref.kind === 'self' ? droneId : ref.id;
}

export function evaluateFunctionCall(call: FunctionCall, droneId: EntityId, world: World): number | null {
  const spec = FUNCTIONS[call.fn];
  const resolved = call.args.map((a) => resolveObjectRef(a, droneId));
  return spec.evaluate(resolved, droneId, world);
}

function isEntityType(types: string[]) {
  return (id: EntityId, world: World): boolean => {
    return types.some((t) => world.getComponent(id, t as 'Energy' | 'Inventory' | 'Deposit' | 'Position') !== undefined);
  };
}

export const FUNCTIONS: Record<FunctionName, FunctionSpec> = {
  Energy: {
    name: 'Energy', label: 'Energy', icon: '⚡',
    arity: 1, argLabels: [''],
    argFilter: isEntityType(['Energy']),
    evaluate: ([id], _droneId, world) => world.getComponent(id, 'Energy')?.current ?? null,
  },
  EnergyMax: {
    name: 'EnergyMax', label: 'EnergyMax', icon: '🔋',
    arity: 1, argLabels: [''],
    argFilter: isEntityType(['Energy']),
    evaluate: ([id], _droneId, world) => world.getComponent(id, 'Energy')?.max ?? null,
  },
  Inventory: {
    name: 'Inventory', label: 'Inventory', icon: '📦',
    arity: 1, argLabels: [''],
    argFilter: isEntityType(['Inventory']),
    evaluate: ([id], _droneId, world) => world.getComponent(id, 'Inventory')?.ore ?? null,
  },
  InventoryMax: {
    name: 'InventoryMax', label: 'InventoryMax', icon: '📦+',
    arity: 1, argLabels: [''],
    argFilter: isEntityType(['Inventory']),
    evaluate: ([id], _droneId, world) => world.getComponent(id, 'Inventory')?.capacity ?? null,
  },
  Deposit: {
    name: 'Deposit', label: 'Deposit', icon: '⛏',
    arity: 1, argLabels: [''],
    argFilter: isEntityType(['Deposit']),
    evaluate: ([id], _droneId, world) => world.getComponent(id, 'Deposit')?.oreRemaining ?? null,
  },
  Distance: {
    name: 'Distance', label: 'Distance', icon: '🛣',
    arity: 2, argLabels: ['от', 'до'],
    argFilter: isEntityType(['Position']),
    evaluate: ([a, b], _droneId, world) => {
      const pa = world.getComponent(a, 'Position');
      const pb = world.getComponent(b, 'Position');
      if (!pa || !pb) return null;
      return Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y);
    },
  },
};
