import { useEffect, useRef, useState } from "react";
import { COPIED_FEEDBACK_MS } from "./styles.js";

/** Копирование значения в буфер с временным фидбэком ⧉ → ✓. */
export function useCopyFeedback() {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(
      () => setCopied(false),
      COPIED_FEEDBACK_MS,
    );
  };

  return { copied, copy };
}
