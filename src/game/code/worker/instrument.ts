import { parse } from "acorn";
import type { Node, AwaitExpression, CallExpression, MemberExpression } from "acorn";

/**
 * Инструментирует код игрока: перед каждым `await self.<action>()`
 * вставляет `(__line(N), ...)` где N — номер строки вызова (1-based).
 * Каждый вызов `__mod_*()` оборачивается в `__call(N, () => ...)`.
 *
 * Для будущего step-режима тот же обходчик можно расширить:
 * вместо синхронного __line(N) вставлять `await __step(N)` на каждый
 * statement — это даст паузу на любой строке. Сейчас НЕ реализуем:
 * инструментируем только await self.* и __line синхронный.
 */

type PatchKind = "await-drone" | "module-call";

interface Patch {
  start: number;
  end: number;
  line: number;
  kind: PatchKind;
}

const PATCH_WRAPPERS: Record<PatchKind, (line: number, original: string) => string> = {
  "await-drone": (line, original) => `;(__line(${line}), ${original})`,
  "module-call": (line, original) => `__call(${line}, () => ${original})`,
};

export function instrument(code: string): string {
  const ast = parse(code, {
    ecmaVersion: 2020,
    locations: true,
    allowAwaitOutsideFunction: true,
  });

  // Собираем все патчи: AwaitExpression вида `await drone.<action>(args)`
  // и CallExpression вида `__mod_<slug>__<name>(args)`.
  // Все сортируются по убыванию offset'а и применяются за один проход,
  // чтобы вставки не смещали уже обработанные позиции.
  const patches: Patch[] = [];

  function visit(node: Node): void {
    if (!node || typeof node !== "object") return;

    if (
      node.type === "AwaitExpression" &&
      isDroneCall((node as AwaitExpression).argument)
    ) {
      const awaitNode = node as AwaitExpression & {
        start: number;
        end: number;
        loc: { start: { line: number } };
      };
      patches.push({
        start: awaitNode.start,
        end: awaitNode.end,
        line: awaitNode.loc.start.line,
        kind: "await-drone",
      });
    }

    if (isModuleCall(node)) {
      const callNode = node as CallExpression & {
        start: number;
        end: number;
        loc: { start: { line: number } };
      };
      patches.push({
        start: callNode.start,
        end: callNode.end,
        line: callNode.loc.start.line,
        kind: "module-call",
      });
      // Не спускаемся в children CallExpression — внутренние self.* будут
      // инструментированы отдельно через AwaitExpression на том же уровне.
      return;
    }

    for (const key of Object.keys(node)) {
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === "object" && "type" in item) {
            visit(item as Node);
          }
        }
      } else if (child && typeof child === "object" && "type" in child) {
        visit(child as Node);
      }
    }
  }

  visit(ast as unknown as Node);

  // Сортируем по убыванию start — вставляем с конца, чтобы не сбивать offsets
  patches.sort((a, b) => b.start - a.start);

  let result = code;
  for (const { start, end, line, kind } of patches) {
    const original = result.slice(start, end);
    result = result.slice(0, start) + PATCH_WRAPPERS[kind](line, original) + result.slice(end);
  }

  return result;
}

const DRONE_ACTIONS = new Set(["moveTo", "mine", "drop", "charge", "wait"]);

const MODULE_CALL_PREFIX = "__mod_";

function isModuleCall(node: Node): boolean {
  if (node.type !== "CallExpression") return false;
  const call = node as CallExpression;
  if (call.callee.type !== "Identifier") return false;
  return (call.callee as { name: string }).name.startsWith(MODULE_CALL_PREFIX);
}

function isDroneCall(node: Node | null | undefined): boolean {
  if (!node || node.type !== "CallExpression") return false;
  const call = node as CallExpression;
  if (call.callee.type !== "MemberExpression") return false;
  const member = call.callee as MemberExpression;
  if (
    member.object.type !== "Identifier" ||
    (member.object as { name: string }).name !== "self"
  )
    return false;
  if (member.property.type !== "Identifier") return false;
  return DRONE_ACTIONS.has((member.property as { name: string }).name);
}
