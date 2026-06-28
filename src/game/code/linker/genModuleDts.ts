import type { ProgramDef } from "../../programs/types.js";
import type { ExportSig } from "../../programs/moduleInterface.js";
import { moduleInterfaceOf } from "../../programs/moduleInterface.js";

/**
 * Генерирует амбиентные `declare module "<slug>" { ... }` для всех программ с
 * экспортами — типизация импортов в Monaco. Типы параметров берутся из JSDoc
 * (@param/@returns) экспортируемой функции, иначе фолбэк (...args: any[]).
 * Drone-api-типы (MineEntity и т.п.) уже амбиентны и резолвятся без импорта.
 */
export function genModuleDts(programs: ProgramDef[]): string {
  const blocks: string[] = [];
  for (const program of programs) {
    const iface = moduleInterfaceOf(program);
    if (!iface) continue;
    const fns = iface.exports.map((e) => `  ${declareFn(e)}`).join("\n");
    blocks.push(`declare module "${iface.slug}" {\n${fns}\n}`);
  }
  return blocks.join("\n\n");
}

/** Строит строку `export function name(params): ReturnType;` из сигнатуры. */
function declareFn(sig: ExportSig): string {
  const tags = parseJsdocTags(sig.jsdoc);
  const params = signatureParams(sig, tags.params);
  const returnType = tags.returns ?? "Promise<void>";
  return `export function ${sig.name}(${params}): ${returnType};`;
}

/**
 * Список параметров для .d.ts. Если JSDoc описал @param-типы — используем
 * `name: type` для каждого параметра; иначе фолбэк `...args: any[]`.
 */
function signatureParams(
  sig: ExportSig,
  paramTypes: Map<string, string>,
): string {
  if (paramTypes.size === 0) return "...args: any[]";
  return sig.params
    .map((name) => {
      const bare = name.replace(/^\.\.\./, "");
      const type = paramTypes.get(bare) ?? "any";
      return `${bare}: ${type}`;
    })
    .join(", ");
}

interface JsdocTags {
  params: Map<string, string>;
  returns?: string;
}

/** Извлекает @param {type} name и @returns {type} из текста JSDoc. */
function parseJsdocTags(jsdoc: string | undefined): JsdocTags {
  const params = new Map<string, string>();
  let returns: string | undefined;
  if (!jsdoc) return { params, returns };

  const paramRe = /@param\s*\{([^}]+)\}\s*(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = paramRe.exec(jsdoc)) !== null) {
    params.set(m[2], m[1].trim());
  }

  const returnRe = /@returns?\s*\{([^}]+)\}/;
  const r = returnRe.exec(jsdoc);
  if (r) returns = r[1].trim();

  return { params, returns };
}
