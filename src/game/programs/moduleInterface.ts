/**
 * Производный (не денормализованный) модульный интерфейс программы.
 * Вычисляется парсингом behavior.code на лету — ProgramDef остаётся только-код.
 */

/** Сигнатура одной экспортируемой функции. */
export interface ExportSig {
  name: string;
  /** Имена параметров в порядке объявления. */
  params: string[];
  isAsync: boolean;
  /**
   * Ведущий JSDoc-комментарий функции (без `/** ... *​/`-обёртки), если есть.
   * Используется genModuleDts для типов @param/@returns.
   */
  jsdoc?: string;
}

/** Модульный интерфейс программы: какие функции она экспортирует под каким slug. */
export interface ModuleInterface {
  slug: string;
  programId: string;
  exports: ExportSig[];
}
