import type { Node } from "acorn";
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
  const order = topoSortDeps(entryId, registry, slugIndex, parseFor);

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
    emit(depId, rewriteModule(def, parseFor(def), slugIndex, registry, false));
  }

  // В конце — entry-программа целиком (её top-level-тело исполняется).
  const entryDef = registry.get(entryId)!;
  emit(
    entryId,
    rewriteModule(entryDef, parseFor(entryDef), slugIndex, registry, true),
  );

  return { code: segments.join("\n"), lineMap };
}

/** slug → programId. Бросает DuplicateSlug при коллизии. */
function buildSlugIndex(registry: ProgramRegistry): Map<string, string> {
  const index = new Map<string, string>();
  for (const def of registry.values()) {
    const s = slug(def.name);
    if (index.has(s)) throw new DuplicateSlug(s);
    index.set(s, def.id);
  }
  return index;
}

/**
 * Итеративный DFS с post-order = топологический порядок. onStack ловит циклы.
 * Возвращает id зависимостей entry (без самого entry), глубокие — первыми.
 */
function topoSortDeps(
  entryId: string,
  registry: ProgramRegistry,
  slugIndex: Map<string, string>,
  parseFor: (def: ProgramDef) => ParsedModule,
): string[] {
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
      throw new CycleError([...onStack, id].map((x) => slug(registry.get(x)!.name)));
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

/**
 * Возвращает тело модуля с вырезанными import/export и переписанными ссылками:
 * top-level-имена → __mod_<slug>__<name>, импортированные локали →
 * __mod_<depSlug>__<importedName>. Для entry (isEntry) top-level-имена НЕ
 * префиксуются — это исполняемое тело, но импортированные локали всё равно
 * переписываются на префиксы их модулей.
 */
function rewriteModule(
  def: ProgramDef,
  mod: ParsedModule,
  slugIndex: Map<string, string>,
  registry: ProgramRegistry,
  isEntry: boolean,
): string {
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

/**
 * Обходит AST модуля, заменяя ссылки на имена из rename — но только если имя
 * не затенено локальной областью видимости (параметр/локальная переменная/
 * вложенная функция). Имена в позиции property/ключа объекта не трогаются.
 */
function collectRenamePatches(
  mod: ParsedModule,
  rename: Map<string, string>,
): RenamePatch[] {
  if (rename.size === 0) return [];
  const patches: RenamePatch[] = [];

  const walk = (node: AnyNode | null, shadowed: ReadonlySet<string>): void => {
    if (!node || typeof node !== "object" || !("type" in node)) return;

    switch (node.type) {
      case "ImportDeclaration":
        // Вся декларация вырезается отдельно — её идентификаторы не патчим,
        // иначе патчи переименования пересекутся с вырезанием.
        return;
      case "Identifier": {
        const name = str(node, "name");
        const target = rename.get(name);
        if (target && !shadowed.has(name)) {
          patches.push({ start: node.start, end: node.end, text: target });
        }
        return;
      }
      case "MemberExpression": {
        // a.b — переписываем object, но не property (если не computed).
        walk(child(node, "object"), shadowed);
        if (node.computed) walk(child(node, "property"), shadowed);
        return;
      }
      case "Property": {
        // { key: value } — key не ссылка (если не computed/не shorthand).
        if (node.computed) walk(child(node, "key"), shadowed);
        walk(child(node, "value"), shadowed);
        return;
      }
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression": {
        const id = child(node, "id");
        // Имя function-декларации — биндинг ВНЕШНЕГО scope: переименовываем его
        // в текущем shadowed (так top-level `function helper` → `__mod_*__helper`).
        if (id && node.type === "FunctionDeclaration") walk(id, shadowed);
        const params = children(node, "params");
        const inner = new Set(shadowed);
        addParamNames(params, inner);
        addLocalBindings(child(node, "body"), inner);
        // Имя именованного функционального выражения видно только внутри себя.
        if (id && node.type === "FunctionExpression") {
          inner.add(str(id, "name"));
        }
        for (const p of params) walk(p, inner);
        walk(child(node, "body"), inner);
        return;
      }
      default:
        break;
    }

    // Общий обход дочерних узлов.
    for (const key of Object.keys(node)) {
      if (key === "type" || key === "start" || key === "end") continue;
      const value = (node as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const item of value) walk(asNode(item), shadowed);
      } else {
        walk(asNode(value), shadowed);
      }
    }
  };

  for (const stmt of mod.ast.body) {
    walk(stmt as unknown as AnyNode, new Set());
  }

  return patches;
}

/** Узкое приведение значения к AnyNode (или null, если это не узел). */
function asNode(value: unknown): AnyNode | null {
  if (value && typeof value === "object" && "type" in value) {
    return value as AnyNode;
  }
  return null;
}

function child(node: AnyNode, key: string): AnyNode | null {
  return asNode(node[key]);
}

function children(node: AnyNode, key: string): AnyNode[] {
  const value = node[key];
  return Array.isArray(value) ? (value as AnyNode[]) : [];
}

function str(node: AnyNode, key: string): string {
  return node[key] as string;
}

/** Добавляет имена параметров (вкл. деструктуризацию/rest/дефолты) в набор. */
function addParamNames(params: AnyNode[], out: Set<string>): void {
  for (const p of params) collectPatternNames(p, out);
}

/** Имена, объявленные локально в теле функции (var/let/const/function). */
function addLocalBindings(body: AnyNode | null, out: Set<string>): void {
  if (!body || body.type !== "BlockStatement") return;
  const statements = (body.body as AnyNode[] | undefined) ?? [];
  for (const stmt of statements) {
    if (stmt.type === "VariableDeclaration") {
      const decls = (stmt.declarations as AnyNode[] | undefined) ?? [];
      for (const d of decls) collectPatternNames(d.id as AnyNode, out);
    } else if (stmt.type === "FunctionDeclaration" && stmt.id) {
      out.add((stmt.id as AnyNode).name as string);
    }
  }
}

/** Извлекает все связываемые имена из паттерна (Identifier/Object/Array/...). */
function collectPatternNames(node: AnyNode | null, out: Set<string>): void {
  if (!node) return;
  switch (node.type) {
    case "Identifier":
      out.add(node.name as string);
      return;
    case "AssignmentPattern":
      collectPatternNames(node.left as AnyNode, out);
      return;
    case "RestElement":
      collectPatternNames(node.argument as AnyNode, out);
      return;
    case "ArrayPattern": {
      const elements = (node.elements as Array<AnyNode | null>) ?? [];
      for (const el of elements) collectPatternNames(el, out);
      return;
    }
    case "ObjectPattern": {
      const properties = (node.properties as AnyNode[]) ?? [];
      for (const prop of properties) {
        if (prop.type === "RestElement") {
          collectPatternNames(prop.argument as AnyNode, out);
        } else {
          collectPatternNames(prop.value as AnyNode, out);
        }
      }
      return;
    }
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
  type Op = { start: number; end: number; text: string };
  const ops: Op[] = [
    ...cuts.map(([start, end]) => ({ start, end, text: "" })),
    ...renames.map((r) => ({ start: r.start, end: r.end, text: r.text })),
  ];
  ops.sort((a, b) => b.start - a.start);

  let result = code;
  for (const op of ops) {
    result = result.slice(0, op.start) + op.text + result.slice(op.end);
  }
  return result;
}

/** Узлы acorn, к которым обращаемся динамически по полям. */
type AnyNode = Node & {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
};
