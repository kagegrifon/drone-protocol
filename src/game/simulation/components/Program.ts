export type ProgramState = 'idle' | 'running' | 'waiting';
export type WaitingFor = 'move' | 'mine' | 'drop' | 'charge';

export interface CallFrame {
  programId: string;
  instructionIndex: number;
  waitRemaining?: number;
  repeatRemaining?: number;
  isLoop?: boolean;
  inlineInstructions?: readonly unknown[];
}

export interface ProgramComponent {
  currentProgramId: string | null;
  callStack: CallFrame[];
  state: ProgramState;
  commandSlots: number;
  waitingFor?: WaitingFor;
  personalProgramId: string;      // всегда заполнено, равно droneEntityId
  assignedProgramId?: string;     // id библиотечной программы если назначена
}
