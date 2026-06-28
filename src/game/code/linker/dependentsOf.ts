import type { ProgramRegistry } from "../../programs/types.js";
import { parseModule } from "./parseModule.js";
import { slug } from "./slug.js";

/**
 * Возвращает id программы и всех программ, которые транзитивно её импортируют.
 * Используется для дропа сессий дронов при редактировании модуля: перезапустить
 * нужно всех, кто зависит от изменённого кода.
 *
 * Устойчива к синтаксически невалидным программам — такие просто не дают рёбер
 * (редактируемая программа может временно не парситься).
 */
export function dependentsOf(
  programId: string,
  registry: ProgramRegistry,
): string[] {
  // Обратный граф: depId → [ids программ, которые его импортируют].
  const importers = new Map<string, string[]>();
  const slugToId = new Map<string, string>();
  for (const def of registry.values()) slugToId.set(slug(def.name), def.id);

  for (const def of registry.values()) {
    const imported = importedSlugs(def.behavior.code);
    for (const spec of imported) {
      const depId = slugToId.get(spec);
      if (depId === undefined) continue;
      const list = importers.get(depId) ?? [];
      list.push(def.id);
      importers.set(depId, list);
    }
  }

  // BFS по обратному графу от programId.
  const result = new Set<string>([programId]);
  const queue = [programId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const importer of importers.get(current) ?? []) {
      if (!result.has(importer)) {
        result.add(importer);
        queue.push(importer);
      }
    }
  }

  return [...result];
}

/** Спецификаторы, импортируемые программой; [] если код не парсится. */
function importedSlugs(code: string): string[] {
  try {
    return parseModule(code).imports.map((i) => i.specifier);
  } catch {
    return [];
  }
}
