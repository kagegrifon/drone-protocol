import type { LineMapSegment } from "./linkProgram.js";

/**
 * Маппит строку склеенного кода назад в исходную программу и строку.
 *
 * v1 («гасить в модулях»): подсветка работает только для строк entry-программы.
 * Если строка принадлежит сегменту модуля-зависимости — возвращаем null, чтобы
 * подсветка погасла. Stack-trace-дебаггинг модулей — отдельный этап 2.
 */
export function mapLine(
  line: number,
  lineMap: LineMapSegment[],
  entryId: string,
): { programId: string; origLine: number } | null {
  for (const seg of lineMap) {
    if (line < seg.fromLine || line > seg.toLine) continue;
    if (seg.programId !== entryId) return null;
    return {
      programId: seg.programId,
      origLine: seg.origLine + (line - seg.fromLine),
    };
  }
  return null;
}
