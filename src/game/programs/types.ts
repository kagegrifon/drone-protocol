import type { EntityId } from '../../shared/types/index.js';

export type ConditionOperator = '<' | '<=' | '=' | '>=' | '>';
export type ConditionLogic = 'AND' | 'OR';

export type ObjectRef =
  | { kind: 'self' }
  | { kind: 'entity'; id: EntityId };

export type FunctionName =
  | 'Energy' | 'EnergyMax'
  | 'Inventory' | 'InventoryMax'
  | 'Deposit'
  | 'Distance';

export type FunctionCall =
  | { fn: 'Energy';       args: [ObjectRef] }
  | { fn: 'EnergyMax';    args: [ObjectRef] }
  | { fn: 'Inventory';    args: [ObjectRef] }
  | { fn: 'InventoryMax'; args: [ObjectRef] }
  | { fn: 'Deposit';      args: [ObjectRef] }
  | { fn: 'Distance';     args: [ObjectRef, ObjectRef] };

export type Operand =
  | { kind: 'number';   value: number }
  | { kind: 'function'; call: FunctionCall };

export type ConditionLeaf = {
  left: FunctionCall;
  operator: ConditionOperator;
  right: Operand;
};

export type ActionBlock =
  | { type: 'MOVE_TO'; targetEntityId: EntityId }
  | { type: 'MINE' }
  | { type: 'DROP' }
  | { type: 'CHARGE' }
  | { type: 'WAIT'; seconds: number };

export type FlowBlock =
  | { type: 'LOOP'; body: Instruction[] }
  | { type: 'REPEAT'; count: number; body: Instruction[] }
  | { type: 'RUN_PROGRAM'; programId: string };

export type ConditionBlock = {
  type: 'IF';
  conditions: ConditionLeaf[];
  operators: ConditionLogic[];  // length === conditions.length - 1
  then: Instruction[];
  else?: Instruction[];
};

export type Instruction = ActionBlock | FlowBlock | ConditionBlock;

export interface ProgramDef {
  id: string;
  name: string;
  instructions: Instruction[];
  personal?: boolean;  // если true — скрыть из списка библиотеки
}

export type ProgramRegistry = Map<string, ProgramDef>;
