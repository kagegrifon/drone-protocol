import { parse } from "acorn";
import type { Node, AwaitExpression, CallExpression, MemberExpression } from "acorn";

/**
 * Инструментирует код игрока: перед каждым `await self.<action>()`
 * вставляет `(__line(N), ...)` где N — номер строки вызова (1-based).
 *
 * Для будущего step-режима тот же обходчик можно расширить:
 * вместо синхронного __line(N) вставлять `await __step(N)` на каждый
 * statement — это даст паузу на любой строке. Сейчас НЕ реализуем:
 * инструментируем только await self.* и __line синхронный.
 */
export function instrument(code: string): string {
  const ast = parse(code, {
    ecmaVersion: 2020,
    locations: true,
    allowAwaitOutsideFunction: true,
  });

  // Собираем все AwaitExpression вида `await drone.<action>(args)`
  // в порядке убывания offset'а, чтобы вставки не смещали предыдущие позиции.
  const patches: Array<{ start: number; end: number; line: number }> = [];

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
      });
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
  for (const { start, end, line } of patches) {
    const original = result.slice(start, end);
    // Добавляем ; перед wrap-ом: без него две подряд строки без ; парсятся
    // как вызов функции — expr1\n(expr2) → expr1(expr2).
    result =
      result.slice(0, start) +
      `;(__line(${line}), ${original})` +
      result.slice(end);
  }

  return result;
}

const DRONE_ACTIONS = new Set(["moveTo", "mine", "drop", "charge", "wait"]);

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
