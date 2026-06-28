import { useState, useRef, useEffect } from "react";
import { CodeEditor } from "./CodeEditor.js";

interface ProgramCodeBlockProps {
  code: string;
  onApply: (code: string) => void;
  affectedDroneIds: number[];
  highlightLine?: number | null;
  codeError?: string | null;
  height?: string;
}

export function ProgramCodeBlock({
  code,
  onApply,
  affectedDroneIds,
  highlightLine,
  codeError,
  height = "240px",
}: ProgramCodeBlockProps) {
  const [draft, setDraft] = useState(code);
  // applied = последний подтверждённый код (baseline для isDirty)
  const [applied, setApplied] = useState(code);
  const prevCodeRef = useRef(code);

  // Синхронизируем baseline только при внешнем изменении prop code
  useEffect(() => {
    if (code !== prevCodeRef.current) {
      prevCodeRef.current = code;
      setApplied(code);
      setDraft(code);
    }
  }, [code]);

  const isDirty = draft !== applied;

  function handleApply() {
    onApply(draft);
    setApplied(draft);
  }

  function handleRevert() {
    setDraft(applied);
  }

  return (
    <div>
      {isDirty && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "8px",
            marginBottom: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            data-testid="code-apply"
            onClick={handleApply}
            style={{
              background: "transparent",
              border: "1px solid #00ff88",
              color: "#00ff88",
              fontFamily: "monospace",
              fontSize: "11px",
              padding: "2px 8px",
              cursor: "pointer",
              borderRadius: "2px",
            }}
          >
            ✓ применить
          </button>
          <button
            data-testid="code-revert"
            onClick={handleRevert}
            style={{
              background: "transparent",
              border: "1px solid #445566",
              color: "#ff8844",
              fontFamily: "monospace",
              fontSize: "11px",
              padding: "2px 8px",
              cursor: "pointer",
              borderRadius: "2px",
            }}
          >
            ↩ отменить
          </button>
          {affectedDroneIds.length > 0 && (
            <span
              data-testid="code-affects"
              style={{
                color: "#ff8844",
                fontFamily: "monospace",
                fontSize: "10px",
              }}
            >
              затронет: {affectedDroneIds.map((id) => `drone-${id}`).join(", ")}
            </span>
          )}
        </div>
      )}

      <CodeEditor
        value={draft}
        onChange={setDraft}
        height={height}
        highlightLine={highlightLine}
      />

      {codeError && (
        <div
          style={{
            color: "#ff4444",
            fontFamily: "monospace",
            fontSize: "11px",
            marginTop: "6px",
            whiteSpace: "pre-wrap",
          }}
        >
          {codeError}
        </div>
      )}
    </div>
  );
}
