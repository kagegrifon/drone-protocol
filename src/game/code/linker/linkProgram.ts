import type { Function as FunctionNode, Identifier, Pattern } from "acorn";
import { recursive, type WalkerCallback } from "acorn-walk";
import type { ProgramDef, ProgramRegistry } from "../../programs/types.js";
import { parseModule, type ParsedModule, type Range } from "./parseModule.js";
import { slug } from "./slug.js";
import {
  CycleError,
  DuplicateSlug,
  MissingExport,
  UnknownSpecifier,
} from "./errors.js";

/** Один непрерывный отрезок склеенного кода → исходная программа и строка. */
export interface LineMapSegment {
  /** Первая строка отрезка в склеенном коде (1-based). */
  fromLine: number;
  /** Последняя строка отрезка в склеенном коде (1-based, включительно). */
  toLine: number;
  programId: string;
  /** Исходная строка программы, соответствующая fromLine (1-based). */
  origLine: number;
}

export interface LinkResult {
  /** Плоский код для тела AsyncFunction — без import/export. */
  code: string;
  lineMap: LineMapSegment[];
}

/**
 * Линкует программу entryId со всеми транзитивно импортируемыми модулями в один
 * плоский код. Чистая функция: реестр не мутируется. Бросает LinkError при
 * любой проблеме линковки (цикл, неизвестный модуль, отсутствующий экспорт…).
 */
export function linkProgram(
  entryId: string,
  registry: ProgramRegistry,
): LinkResult {
  const slugIndex = buildSlugIndex(registry);
  const parsed = new Map<string, ParsedModule>();

  const parseFor = (def: ProgramDef): ParsedModule => {
    let p = parsed.get(def.id);
    if (!p) {
      p = parseModule(def.behavior.code);
      parsed.set(def.id, p);
    }
    return p;
  };

  // Топологический порядок зависимостей entry (без самого entry).
  const order = topoSortDeps({ entryId, registry, slugIndex, parseFor });

  const segments: string[] = [];
  const lineMap: LineMapSegment[] = [];
  let cursorLine = 1;

  const emit = (programId: string, body: string): void => {
    const lineCount = body.split("\n").length;
    segments.push(body);
    lineMap.push({
      fromLine: cursorLine,
      toLine: cursorLine + lineCount - 1,
      programId,
      origLine: 1,
    });
    cursorLine += lineCount;
  };

  // Сначала тела модулей-зависимостей (только определения функций).
  for (const depId of order) {
    const def = registry.get(depId)!;
    emit(depId, rewriteModule({ def, mod: parseFor(def), slugIndex, registry, isEntry: false }));
  }

  // В конце — entry-программа целиком (её top-level-тело исполняется).
  const entryDef = registry.get(entryId)!;
  emit(
    entryId,
    rewriteModule({ def: entryDef, mod: parseFor(entryDef), slugIndex, registry, isEntry: true }),
  );

  return { code: segments.join("\n"), lineMap };
}

/** slug → programId. Бросает DuplicateSlug при коллизии. */
function buildSlugIndex(registry: ProgramRegistry): Map<string, string> {
  const index = new Map<string, string>();
  for (const def of registry.values()) {
    const programSlug = slug(def.name);
    if (index.has(programSlug)) throw new DuplicateSlug(programSlug);
    index.set(programSlug, def.id);
  }
  return index;
}

interface TopoSortDepsArgs {
  entryId: string;
  registry: ProgramRegistry;
  slugIndex: Map<string, string>;
  parseFor: (def: ProgramDef) => ParsedModule;
}

/**
 * Итеративный DFS с post-order = топологический порядок. onStack ловит циклы.
 * Возвращает id зависимостей entry (без самого entry), глубокие — первыми.
 */
function topoSortDeps({
  entryId,
  registry,
  slugIndex,
  parseFor,
}: TopoSortDepsArgs): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  const onStack = new Set<string>();

  const resolveDeps = (id: string): string[] => {
    const def = registry.get(id)!;
    const mod = parseFor(def);
    const deps: string[] = [];
    for (const imp of mod.imports) {
      const depId = slugIndex.get(imp.specifier);
      if (depId === undefined) throw new UnknownSpecifier(imp.specifier);
      const depMod = parseFor(registry.get(depId)!);
      const exported = new Set(depMod.exports.map((e) => e.sig.name));
      for (const { imported } of imp.names) {
        if (!exported.has(imported)) {
          throw new MissingExport(imp.specifier, imported);
        }
      }
      deps.push(depId);
    }
    return deps;
  };

  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (onStack.has(id)) {
      throw new CycleError(
        [...onStack, id].map((x) => slug(registry.get(x)!.name)),
      );
    }
    onStack.add(id);
    for (const depId of resolveDeps(id)) visit(depId);
    onStack.delete(id);
    visited.add(id);
    order.push(id);
  };

  // Обходим зависимости entry, но сам entry в order не включаем.
  onStack.add(entryId);
  for (const depId of resolveDeps(entryId)) visit(depId);
  onStack.delete(entryId);

  return order;
}

interface RewriteModuleArgs {
  def: ProgramDef;
  mod: ParsedModule;
  slugIndex: Map<string, string>;
  registry: ProgramRegistry;
  isEntry: boolean;
}

/**
 * Возвращает тело модуля с вырезанными import/export и переписанными ссылками:
 * top-level-имена → __mod_<slug>__<name>, импортированные локали →
 * __mod_<depSlug>__<importedName>. Для entry (isEntry) top-level-имена НЕ
 * префиксуются — это исполняемое тело, но импортированные локали всё равно
 * переписываются на префиксы их модулей.
 */
function rewriteModule({
  def,
  mod,
  slugIndex,
  registry,
  isEntry,
}: RewriteModuleArgs): string {
  const code = def.behavior.code;
  const ownSlug = slug(def.name);

  // Карта переименования top-level-идентификаторов модуля.
  const rename = new Map<string, string>();
  if (!isEntry) {
    for (const name of mod.topLevelNames) {
      rename.set(name, `__mod_${ownSlug}__${name}`);
    }
  }
  // Импортированные локали → префикс модуля-источника (всегда, и для entry).
  for (const imp of mod.imports) {
    const depSlug = slug(registry.get(slugIndex.get(imp.specifier)!)!.name);
    for (const { imported, local } of imp.names) {
      rename.set(local, `__mod_${depSlug}__${imported}`);
    }
  }

  // Собираем диапазоны на вырезание: import-декларации и слова `export `.
  const cuts: Range[] = [
    ...mod.imports.map((i) => i.range),
    ...mod.exports.map((e) => e.exportKeywordRange),
  ];

  // Собираем патчи переименования ссылок (scope-aware).
  const renamePatches = collectRenamePatches(mod, rename);

  return applyPatches(code, cuts, renamePatches);
}

interface RenamePatch {
  start: number;
  end: number;
  text: string;
}

/** Состояние обхода: имена, затенённые текущей областью видимости. */
type Shadowed = ReadonlySet<string>;

/**
 * Обходит AST модуля (acorn-walk recursive), заменяя ссылки на имена из rename —
 * но только если имя не затенено локальной областью видимости (параметр/локальная
 * переменная/вложенная функция). Обход MemberExpression/Property берётся из base
 * acorn-walk: он сам пропускает property/ключ объекта в не-computed позиции.
 */
function collectRenamePatches(
  mod: ParsedModule,
  rename: Map<string, string>,
): RenamePatch[] {
  if (rename.size === 0) return [];
  const patches: RenamePatch[] = [];

  recursive<Shadowed>(mod.ast, new Set(), {
    // Вся import-декларация вырезается отдельно — её идентификаторы не патчим,
    // иначе патчи переименования пересеклись бы с вырезанием. Не спускаемся.
    ImportDeclaration() {},

    Identifier(node, shadowed) {
      const target = rename.get(node.name);
      if (target && !shadowed.has(node.name)) {
        patches.push({ start: node.start, end: node.end, text: target });
      }
    },

    Function(node, shadowed, callback) {
      walkFunction(node, shadowed, callback);
    },
  });

  return patches;
}

/**
 * Обходит функцию с учётом её области видимости. Имя function-декларации — биндинг
 * ВНЕШНЕГО scope, поэтому переименовывается в текущем shadowed (так top-level
 * `function helper` → `__mod_*__helper`). Тело и параметры видят расширенный scope.
 */
function walkFunction(
  node: FunctionNode,
  shadowed: Shadowed,
  callback: WalkerCallback<Shadowed>,
): void {
  if (node.type === "FunctionDeclaration" && node.id) {
    callback(node.id, shadowed);
  }

  const inner = new Set(shadowed);
  for (const param of node.params) collectPatternNames(param, inner);
  addLocalBindings(node.body, inner);
  // Имя именованного функционального выражения видно только внутри себя.
  if (node.type === "FunctionExpression" && node.id) {
    inner.add(node.id.name);
  }

  for (const param of node.params) callback(param, inner);
  callback(node.body, inner);
}

/** Имена, объявленные локально в теле функции (var/let/const/function). */
function addLocalBindings(body: FunctionNode["body"], out: Set<string>): void {
  if (body.type !== "BlockStatement") return;
  for (const stmt of body.body) {
    if (stmt.type === "VariableDeclaration") {
      for (const d of stmt.declarations) collectPatternNames(d.id, out);
    } else if (stmt.type === "FunctionDeclaration" && stmt.id) {
      out.add(stmt.id.name);
    }
  }
}

/** Извлекает все связываемые имена из паттерна (Identifier/Object/Array/...). */
function collectPatternNames(
  node: Pattern | Identifier,
  out: Set<string>,
): void {
  switch (node.type) {
    case "Identifier":
      out.add(node.name);
      return;
    case "AssignmentPattern":
      collectPatternNames(node.left, out);
      return;
    case "RestElement":
      collectPatternNames(node.argument, out);
      return;
    case "ArrayPattern":
      for (const el of node.elements) {
        if (el) collectPatternNames(el, out);
      }
      return;
    case "ObjectPattern":
      for (const prop of node.properties) {
        if (prop.type === "RestElement") {
          collectPatternNames(prop.argument, out);
        } else {
          collectPatternNames(prop.value, out);
        }
      }
      return;
    default:
      return;
  }
}

/** Вырезает cuts и применяет переименования, патча с конца по offset'ам. */
function applyPatches(
  code: string,
  cuts: Range[],
  renames: RenamePatch[],
): string {
  const ops: RenamePatch[] = [
    ...cuts.map(([start, end]) => ({ start, end, text: "" })),
    ...renames,
  ];
  ops.sort((a, b) => b.start - a.start);

  let result = code;
  for (const op of ops) {
    result = result.slice(0, op.start) + op.text + result.slice(op.end);
  }
  return result;
}
