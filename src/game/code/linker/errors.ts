/**
 * Типизированные ошибки линковки модулей. Все наследуют LinkError, чтобы в
 * CodeBehaviorDriver.step() можно было одной проверкой `instanceof LinkError`
 * перехватить любую и положить `err.message` в program.codeError.
 */
export abstract class LinkError extends Error {
  abstract readonly kind: string;
}

/** Нет программы, чей slug совпал бы со спецификатором импорта. */
export class UnknownSpecifier extends LinkError {
  readonly kind = "UnknownSpecifier";
  constructor(specifier: string) {
    super(`Unknown module "${specifier}" — no program with this name`);
  }
}

/** Программа найдена по slug, но не экспортирует запрошенное имя. */
export class MissingExport extends LinkError {
  readonly kind = "MissingExport";
  constructor(specifier: string, name: string) {
    super(`Module "${specifier}" does not export "${name}"`);
  }
}

/** Циклический импорт. path — slug'и по DFS-стеку, замыкающие цикл. */
export class CycleError extends LinkError {
  readonly kind = "CycleError";
  constructor(path: string[]) {
    super(`Circular import: ${path.join(" → ")}`);
  }
}

/** Две разные программы дают один и тот же спецификатор (slug). */
export class DuplicateSlug extends LinkError {
  readonly kind = "DuplicateSlug";
  constructor(specifier: string) {
    super(`Duplicate module name "${specifier}" — two programs share this slug`);
  }
}

/**
 * Неподдерживаемый в v1 синтаксис: export const/default, export { a, b },
 * ре-экспорт, default/namespace import.
 */
export class UnsupportedSyntax extends LinkError {
  readonly kind = "UnsupportedSyntax";
  constructor(detail: string) {
    super(`Unsupported module syntax: ${detail}`);
  }
}

/** Внутри одного модуля одно имя экспортировано дважды. */
export class DuplicateExportName extends LinkError {
  readonly kind = "DuplicateExportName";
  constructor(name: string) {
    super(`Duplicate export "${name}" in the same program`);
  }
}
