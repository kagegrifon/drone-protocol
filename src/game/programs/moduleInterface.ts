/**
 * Производный (не денормализованный) модульный интерфейс программы.
 * Вычисляется парсингом behavior.code на лету — ProgramDef остаётся только-код.
 */
import type { ProgramDef } from "./types.js";
import { parseModule } from "../code/linker/parseModule.js";
import { slug } from "../code/linker/slug.js";

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

/**
 * Выводит модульный интерфейс программы из её кода. Возвращает null, если
 * программа ничего не экспортирует или код не парсится (редактируется).
 */
export function moduleInterfaceOf(program: ProgramDef): ModuleInterface | null {
  try {
    const parsed = parseModule(program.behavior.code);
    if (parsed.exports.length === 0) return null;
    return {
      slug: slug(program.name),
      programId: program.id,
      exports: parsed.exports.map((e) => e.sig),
    };
  } catch {
    return null;
  }
}
