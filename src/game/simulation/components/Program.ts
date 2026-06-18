export type ProgramState =
  | "idle"
  | "running"
  | "move"
  | "mine"
  | "drop"
  | "charge";

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
  personalProgramId: string; // всегда заполнено, равно droneEntityId
  assignedProgramId?: string; // id библиотечной программы если назначена
  mineProgress?: number; // безразмерный прогресс [0..1) текущей mine-операции
  chargeProgress?: number; // безразмерный прогресс [0..1) текущей charge-операции
  dropProgress?: number; // безразмерный прогресс [0..1) текущей drop-операции
  localPaused?: boolean; // per-drone пауза, независимая от глобальной
  /** Исходный код игрока для source==='code' (этап 1: временно на компоненте). */
  codeSource?: string;
  /** Сообщение об ошибке исполнения кода (включая таймаут синхронного участка). */
  codeError?: string;
}
