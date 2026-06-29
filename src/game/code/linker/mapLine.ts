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

interface MapStackToEntryLineArgs {
  lineStack: number[];
  lineMap: LineMapSegment[];
  entryId: string;
}

/**
 * Из стека склеенных строк выбирает строку для подсветки entry-программы:
 * самую глубокую строку, принадлежащую entry-сегменту.
 *
 * Пока выполняется тело подпрограммы, lineStack содержит строку вызова (entry)
 * и строки внутри модуля. mapLine для модульных строк вернёт null — они
 * пропускаются; entry-строка вызова победит.
 */
export function mapStackToEntryLine({
  lineStack,
  lineMap,
  entryId,
}: MapStackToEntryLineArgs): number | null {
  let result: number | null = null;
  for (const gluedLine of lineStack) {
    const mapped = mapLine(gluedLine, lineMap, entryId);
    if (mapped !== null) {
      result = mapped.origLine;
    }
  }
  return result;
}
