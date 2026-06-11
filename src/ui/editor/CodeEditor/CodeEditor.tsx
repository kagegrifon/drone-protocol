import Editor from "@monaco-editor/react";
import { setupMonaco } from "./monacoSetup.js";

setupMonaco();

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  height?: string;
}

export function CodeEditor({
  value,
  onChange,
  readOnly,
  height = "300px",
}: CodeEditorProps) {
  return (
    <div
      style={{ height, border: "1px solid #1e3a5f", borderRadius: "4px" }}
    >
      <Editor
        height="100%"
        language="typescript"
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 12,
          fontFamily: "monospace",
        }}
      />
    </div>
  );
}
