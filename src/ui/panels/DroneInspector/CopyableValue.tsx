import { useCopyFeedback } from "./useCopyFeedback.js";
import { COPY_BTN, MONO } from "./styles.js";

export function CopyableValue({
  testId,
  copyTestId,
  color,
  text,
  copyText,
  title,
}: {
  testId: string;
  copyTestId: string;
  color: string;
  text: string;
  copyText: string;
  title: string;
}) {
  const { copied, copy } = useCopyFeedback();

  return (
    <>
      <span data-testid={testId} style={{ ...MONO, color }}>
        {text}
      </span>
      <button
        data-testid={copyTestId}
        style={COPY_BTN}
        onClick={() => copy(copyText)}
        title={title}
      >
        {copied ? "✓" : "⧉"}
      </button>
    </>
  );
}
