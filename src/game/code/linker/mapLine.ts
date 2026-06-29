import type { LineMapSegment } from "./linkProgram.js";

/** Кадр стека вызовов: программа и активная строка в её ИСХОДНОМ коде (1-based). */
export interface StackFrame {
  programId: string;
  line: number;
}

/**
 * Резолвит строку склеенного кода в исходную программу и строку — БЕЗ entry-фильтра.
 * Возвращает кадр для любого сегмента (entry или модуль) либо null, если строка
 * не попала ни в один сегмент. Базовый кирпич для mapLine и mapStackToFrames.
 */
function resolveSegment(line: number, lineMap: LineMapSegment[]): StackFrame | null {
  for (const segment of lineMap) {
    if (line < segment.fromLine || line > segment.toLine) continue;
    return {
      programId: segment.programId,
      line: segment.origLine + (line - segment.fromLine),
    };
  }
  return null;
}

/**
 * Маппит строку склеенного кода назад в исходную программу и строку.
 *
 * v1 («гасить в модулях»): подсветка работает только для строк entry-программы.
 * Если строка принадлежит сегменту модуля-зависимости — возвращаем null, чтобы
 * подсветка погасла. Полный stack-trace модулей даёт mapStackToFrames.
 */
export function mapLine(
  line: number,
  lineMap: LineMapSegment[],
  entryId: string,
): { programId: string; origLine: number } | null {
  const frame = resolveSegment(line, lineMap);
  if (frame === null || frame.programId !== entryId) return null;
  return { programId: frame.programId, origLine: frame.line };
}

interface MapStackArgs {
  lineStack: number[];
  lineMap: LineMapSegment[];
}

/**
 * Маппит ВЕСЬ стек склеенных строк в кадры исходных программ.
 *
 * В отличие от mapStackToEntryLine не гасит модульные кадры — возвращает полный
 * стек: внешний кадр (entry) первым, самый глубокий (текущая активная строка) —
 * последним. Строки, не попавшие ни в один сегмент, пропускаются.
 */
export function mapStackToFrames({ lineStack, lineMap }: MapStackArgs): StackFrame[] {
  const frames: StackFrame[] = [];
  for (const gluedLine of lineStack) {
    const frame = resolveSegment(gluedLine, lineMap);
    if (frame !== null) frames.push(frame);
  }
  return frames;
}

interface MapStackToEntryLineArgs extends MapStackArgs {
  entryId: string;
}

/**
 * Из стека склеенных строк выбирает строку для подсветки entry-программы:
 * самую глубокую строку, принадлежащую entry-сегменту.
 *
 * Переразено через mapStackToFrames: берём последний кадр с programId === entryId.
 */
export function mapStackToEntryLine({
  lineStack,
  lineMap,
  entryId,
}: MapStackToEntryLineArgs): number | null {
  const frames = mapStackToFrames({ lineStack, lineMap });
  let result: number | null = null;
  for (const frame of frames) {
    if (frame.programId === entryId) {
      result = frame.line;
    }
  }
  return result;
}
