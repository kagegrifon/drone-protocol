import { useState } from "react";
import type { Instruction } from "../../game/programs/types.js";
import type { EntityMeta } from "../../game/missions/types.js";

export const NEW_INSTRUCTION_TYPES: Instruction["type"][] = [
  "MOVE_TO",
  "MINE",
  "DROP",
  "CHARGE",
  "WAIT",
  "LOOP",
  "REPEAT",
  "WHILE",
  "IF",
  "RUN_PROGRAM",
];

export function makeDefaultInstruction(
  type: Instruction["type"],
  entities: EntityMeta[],
  programIds: string[],
): Instruction {
  switch (type) {
    case "MOVE_TO":
      return { type: "MOVE_TO", targetEntityId: entities[0]?.id ?? 1 };
    case "MINE":
      return { type: "MINE" };
    case "DROP":
      return { type: "DROP" };
    case "CHARGE":
      return { type: "CHARGE" };
    case "WAIT":
      return { type: "WAIT", seconds: 1 };
    case "LOOP":
      return { type: "LOOP", body: [] };
    case "REPEAT":
      return { type: "REPEAT", count: 3, body: [] };
    case "WHILE":
      return { type: "WHILE", conditions: [], operators: [], body: [] };
    case "IF":
      return { type: "IF", conditions: [], operators: [], then: [], else: [] };
    case "RUN_PROGRAM":
      return { type: "RUN_PROGRAM", programId: programIds[0] ?? "" };
  }
}

export function AddInstructionMenu({
  onAdd,
}: {
  onAdd: (type: Instruction["type"]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: "4px" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none",
          border: "1px dashed #1e3a5f",
          color: "#445566",
          cursor: "pointer",
          fontFamily: "monospace",
          fontSize: "11px",
          padding: "4px 10px",
          borderRadius: "3px",
          width: "100%",
        }}
      >
        + add instruction
      </button>
      {open && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px",
            marginTop: "6px",
          }}
        >
          {NEW_INSTRUCTION_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => {
                onAdd(type);
                setOpen(false);
              }}
              style={{
                background: "#0a1628",
                border: "1px solid #1e3a5f",
                color: "#aabbcc",
                fontFamily: "monospace",
                fontSize: "10px",
                padding: "3px 8px",
                cursor: "pointer",
                borderRadius: "3px",
              }}
            >
              {type}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
