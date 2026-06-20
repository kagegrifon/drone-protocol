import { useEffect, useRef } from "react";
import Editor, { type OnMount, useMonaco } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { setupMonaco } from "./monacoSetup.js";
import "./codeHighlight.css";

setupMonaco();

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  height?: string;
  highlightLine?: number | null;
}

export function CodeEditor({
  value,
  onChange,
  readOnly,
  height = "300px",
  highlightLine,
}: CodeEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef =
    useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const monaco = useMonaco();

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    const col = editor.createDecorationsCollection([]);
    decorationsRef.current = col;
    if (highlightLine != null && monaco) {
      col.set([
        {
          range: new monaco.Range(highlightLine, 1, highlightLine, 1),
          options: {
            isWholeLine: true,
            className: "drone-line-highlight",
            glyphMarginClassName: "drone-line-glyph",
          },
        },
      ]);
    }
  };

  useEffect(() => {
    const editor = editorRef.current;
    const decorations = decorationsRef.current;
    if (!editor || !decorations || !monaco) return;

    if (highlightLine == null) {
      decorations.set([]);
      return;
    }

    decorations.set([
      {
        range: new monaco.Range(highlightLine, 1, highlightLine, 1),
        options: {
          isWholeLine: true,
          className: "drone-line-highlight",
          glyphMarginClassName: "drone-line-glyph",
        },
      },
    ]);
  }, [highlightLine, monaco]);

  return (
    <div style={{ height, border: "1px solid #1e3a5f", borderRadius: "4px" }}>
      <Editor
        height="100%"
        language="typescript"
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 12,
          fontFamily: "monospace",
          glyphMargin: true,
        }}
      />
    </div>
  );
}
