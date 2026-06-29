import type { StackFrame } from "../../../game/code/linker/mapLine.js";

interface ResolveDisplayedFrameArgs {
  frames: StackFrame[];
  /** Выбранный вручную кадр или null = follow (самый глубокий). */
  selectedIndex: number | null;
}

/**
 * Какой кадр стека показывает редактор DRONE-вкладки.
 *
 * - follow (selectedIndex === null) → самый глубокий кадр (текущее исполнение);
 * - заданный валидный selectedIndex → выбранный кадр;
 * - selectedIndex за пределами стека (подпрограмма завершилась) → fallback на
 *   follow (самый глубокий). UI отдельно сбрасывает selectedIndex в null.
 * - пустой стек → null.
 */
export function resolveDisplayedFrame({
  frames,
  selectedIndex,
}: ResolveDisplayedFrameArgs): StackFrame | null {
  if (frames.length === 0) return null;
  const deepestIndex = frames.length - 1;
  const isValidSelection =
    selectedIndex !== null && selectedIndex >= 0 && selectedIndex < frames.length;
  const targetIndex = isValidSelection ? selectedIndex : deepestIndex;
  return frames[targetIndex];
}
