import type { EntityId } from '../../shared/types/index.js';

export type Condition =
  | { type: 'INVENTORY_FULL' }
  | { type: 'INVENTORY_EMPTY' }
  | { type: 'ENERGY_LOW'; threshold: number }
  | { type: 'ENERGY_FULL' }
  | { type: 'DEPOSIT_EMPTY' };

export type ActionBlock =
  | { type: 'MOVE_TO'; targetEntityId: EntityId }
  | { type: 'MINE' }
  | { type: 'DROP' }
  | { type: 'CHARGE' }
  | { type: 'WAIT'; ticks: number };

export type FlowBlock =
  | { type: 'LOOP'; body: Instruction[] }
  | { type: 'REPEAT'; count: number; body: Instruction[] }
  | { type: 'RUN_PROGRAM'; programId: string };

export type ConditionBlock = {
  type: 'IF';
  condition: Condition;
  then: Instruction[];
  else?: Instruction[];
};

export type Instruction = ActionBlock | FlowBlock | ConditionBlock;

export interface ProgramDef {
  id: string;
  name: string;
  instructions: Instruction[];
}

export type ProgramRegistry = Map<string, ProgramDef>;
