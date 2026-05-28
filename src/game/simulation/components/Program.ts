import type { ConditionLeaf, ConditionLogic } from '../../programs/types.js';

export type ProgramState = 'idle' | 'running' | 'waiting';
export type WaitingFor = 'move' | 'mine' | 'drop' | 'charge';

export interface CallFrame {
  programId: string;
  instructionIndex: number;
  waitRemaining?: number;
  repeatRemaining?: number;
  isLoop?: boolean;
  inlineInstructions?: readonly unknown[];
  whileConditions?: ConditionLeaf[];
  whileOperators?: ConditionLogic[];
}

export interface ProgramComponent {
  currentProgramId: string | null;
  callStack: CallFrame[];
  state: ProgramState;
  commandSlots: number;
  waitingFor?: WaitingFor;
  personalProgramId: string;      // всегда заполнено, равно droneEntityId
  assignedProgramId?: string;     // id библиотечной программы если назначена
  mineElapsed?: number;           // секунды с начала текущей mine-операции
  chargeElapsed?: number;         // секунды с начала текущей charge-операции
  dropElapsed?: number;           // секунды с начала текущей drop-операции
  localPaused?: boolean;          // per-drone пауза, независимая от глобальной
}
