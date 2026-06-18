export type DroneBehavior = { sourceForm: "code"; code: string };
// на текущем моменте работаем только с кодом. Логику с блоком дорабатываем
// после завершения работы с кодом
// | { sourceForm: "block"; instructions: Instruction[] }

export interface ProgramDef {
  id: string;
  name: string;
  personal?: boolean;
  behavior: DroneBehavior;
}

export type ProgramRegistry = Map<string, ProgramDef>;
