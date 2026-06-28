import { parse } from "acorn";
import type {
  Program,
  Node,
  ImportDeclaration,
  ExportNamedDeclaration,
  FunctionDeclaration,
  Comment,
} from "acorn";
import type { ExportSig } from "../../programs/moduleInterface.js";
import { UnsupportedSyntax } from "./errors.js";

/** Половинный интервал [start, end) по offset'ам исходника (acorn). */
export type Range = [start: number, end: number];

export interface ParsedImport {
  specifier: string;
  names: Array<{ imported: string; local: string }>;
  /** Диапазон всей ImportDeclaration — вырезается при линковке. */
  range: Range;
}

export interface ParsedExport {
  sig: ExportSig;
  /** Диапазон ключевого слова `export ` перед function — вырезается. */
  exportKeywordRange: Range;
}

export interface ParsedModule {
  ast: Program;
  imports: ParsedImport[];
  exports: ParsedExport[];
  /** Все top-level function-биндинги (включая приватные) — для неймспейсинга. */
  topLevelNames: string[];
}

interface Located extends Node {
  start: number;
  end: number;
}

/**
 * Парсит код программы как ES-модуль (acorn, sourceType: "module"), извлекая
 * импорты, экспорты-функции и top-level-имена. Неподдерживаемый в v1 синтаксис
 * отклоняется UnsupportedSyntax. Линковка работает на этих данных.
 */
export function parseModule(code: string): ParsedModule {
  const comments: Comment[] = [];
  const ast = parse(code, {
    ecmaVersion: 2020,
    sourceType: "module",
    locations: true,
    allowAwaitOutsideFunction: true,
    onComment: comments,
  }) as Program;

  const imports: ParsedImport[] = [];
  const exports: ParsedExport[] = [];
  const topLevelNames: string[] = [];

  for (const node of ast.body) {
    if (node.type === "ImportDeclaration") {
      imports.push(parseImport(node));
    } else if (node.type === "ExportNamedDeclaration") {
      exports.push(parseNamedExport(node));
      const decl = node.declaration as FunctionDeclaration;
      topLevelNames.push(decl.id!.name);
    } else if (node.type === "ExportDefaultDeclaration") {
      throw new UnsupportedSyntax("export default is not supported");
    } else if (node.type === "ExportAllDeclaration") {
      throw new UnsupportedSyntax("re-export (export *) is not supported");
    } else if (node.type === "FunctionDeclaration") {
      topLevelNames.push(node.id!.name);
    }
  }

  attachJsdoc(exports, code, comments);

  return { ast, imports, exports, topLevelNames };
}

function parseImport(node: ImportDeclaration): ParsedImport {
  const specifier = String(node.source.value);
  const names: Array<{ imported: string; local: string }> = [];
  for (const spec of node.specifiers) {
    if (spec.type !== "ImportSpecifier") {
      throw new UnsupportedSyntax(
        "only named imports are supported (no default/namespace import)",
      );
    }
    const imported = spec.imported;
    if (imported.type !== "Identifier") {
      throw new UnsupportedSyntax("string-named import is not supported");
    }
    names.push({ imported: imported.name, local: spec.local.name });
  }
  const located = node as Located;
  return { specifier, names, range: [located.start, located.end] };
}

function parseNamedExport(node: ExportNamedDeclaration): ParsedExport {
  // export { a, b } / export { x } from "..." — нет declaration.
  if (!node.declaration) {
    throw new UnsupportedSyntax(
      "export list / re-export is not supported (use `export function`)",
    );
  }
  if (node.declaration.type !== "FunctionDeclaration") {
    throw new UnsupportedSyntax(
      "only `export [async] function` is supported (not export const/let/var)",
    );
  }
  const fn = node.declaration;
  const sig: ExportSig = {
    name: fn.id!.name,
    params: fn.params.map(paramName),
    isAsync: fn.async,
  };
  // `export ` занимает от начала ExportNamedDeclaration до начала декларации.
  const exportNode = node as Located;
  const declNode = fn as unknown as Located;
  return {
    sig,
    exportKeywordRange: [exportNode.start, declNode.start],
  };
}

function paramName(param: FunctionDeclaration["params"][number]): string {
  if (param.type === "Identifier") return param.name;
  // Деструктуризация/rest/дефолты — для v1 берём плейсхолдер, типы всё равно any.
  if (param.type === "RestElement" && param.argument.type === "Identifier") {
    return `...${param.argument.name}`;
  }
  if (param.type === "AssignmentPattern" && param.left.type === "Identifier") {
    return param.left.name;
  }
  return "arg";
}

/** Привязывает к каждому экспорту ведущий блочный JSDoc-комментарий, если он есть. */
function attachJsdoc(
  exports: ParsedExport[],
  code: string,
  comments: Comment[],
): void {
  for (const exp of exports) {
    const exportStart = exp.exportKeywordRange[0];
    const jsdoc = leadingJsdoc(exportStart, code, comments);
    if (jsdoc) exp.sig.jsdoc = jsdoc;
  }
}

/**
 * Ищет блочный комментарий, заканчивающийся непосредственно перед `position`
 * (между ними только пробелы/переводы строк). Возвращает его внутренний текст.
 */
function leadingJsdoc(
  position: number,
  code: string,
  comments: Comment[],
): string | undefined {
  for (const c of comments) {
    if (c.type !== "Block") continue;
    const located = c as Comment & { start: number; end: number };
    const between = code.slice(located.end, position);
    if (between.trim() === "") {
      return code.slice(located.start + 2, located.end - 2);
    }
  }
  return undefined;
}
