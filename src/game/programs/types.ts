import type { EntityId } from '../../shared/types/index.js';

export type ConditionOperator = '<' | '<=' | '=' | '>=' | '>';
export type ConditionLogic = 'AND' | 'OR';

export type ConditionProperty =
  | { kind: 'ENERGY';    unit: '%' | 'abs' }
  | { kind: 'INVENTORY'; unit: '%' | 'abs' }
  | { kind: 'DEPOSIT' }
  | { kind: 'DISTANCE';  targetEntityId: EntityId };

export type ConditionLeaf = {
  property: ConditionProperty;
  operator: ConditionOperator;
  value: number;   // % → 0..100, abs/кл. → целое число
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
