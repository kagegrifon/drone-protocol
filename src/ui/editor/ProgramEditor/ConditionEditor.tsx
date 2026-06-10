import { useState } from "react";
import type {
  ConditionLeaf,
  ConditionLogic,
  ConditionOperator,
  FunctionCall,
  Operand,
} from "../../../game/programs/types.js";
import type { EntityMeta } from "../../../game/missions/types.js";
import { FunctionCallEditor } from "./FunctionCallEditor.js";
import { formatConditions } from "./conditionFormat.js";

interface Props {
  conditions: ConditionLeaf[];
  operators: ConditionLogic[];
  entities: EntityMeta[];
  onSave: (conditions: ConditionLeaf[], operators: ConditionLogic[]) => void;
  onCancel: () => void;
}

const OPERATORS: ConditionOperator[] = ["<", "<=", "=", ">=", ">"];

function defaultLeaf(): ConditionLeaf {
  return {
    left: { fn: "Energy", args: [{ kind: "self" }] },
    operator: "<",
    right: { kind: "number", value: 50 },
  };
}

const selectStyle: React.CSSProperties = {
  background: "#0a1628",
  border: "1px solid #1e3a5f",
  color: "#aabbcc",
  fontFamily: "monospace",
  fontSize: "11px",
  padding: "2px 4px",
  borderRadius: "2px",
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
  width: "52px",
};

export function ConditionEditor({
  conditions: initConditions,
  operators: initOperators,
  entities,
  onSave,
  onCancel,
}: Props) {
  const [conditions, setConditions] = useState<ConditionLeaf[]>(
    initConditions.length > 0 ? initConditions : [defaultLeaf()],
  );
  const [operators, setOperators] = useState<ConditionLogic[]>(initOperators);

  function updateCondition(index: number, updated: ConditionLeaf) {
    setConditions((prev) => prev.map((c, i) => (i === index ? updated : c)));
  }

  function removeCondition(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index));
    setOperators((prev) => {
      const next = [...prev];
      next.splice(index === 0 ? 0 : index - 1, 1);
      return next;
    });
  }

  function addCondition() {
    setConditions((prev) => [...prev, defaultLeaf()]);
    setOperators((prev) => [...prev, "AND"]);
  }

  function toggleOperator(index: number) {
    setOperators((prev) =>
      prev.map((op, i) => (i === index ? (op === "AND" ? "OR" : "AND") : op)),
    );
  }

  return (
    <div
      style={{
        marginTop: "6px",
        padding: "10px",
        background: "#060f1e",
        border: "1px solid #1e3a5f",
        borderRadius: "4px",
      }}
    >
      <div
        style={{
          color: "#445566",
          fontFamily: "monospace",
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "1px",
          marginBottom: "8px",
        }}
      >
        ⚙️ Условие IF
      </div>

      {conditions.map((leaf, index) => (
        <div key={index}>
          <ConditionRow
            leaf={leaf}
            entities={entities}
            onChange={(updated) => updateCondition(index, updated)}
            onRemove={() => removeCondition(index)}
          />
          {index < operators.length && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                margin: "4px 0",
              }}
            >
              <button
                onClick={() => toggleOperator(index)}
                style={{
                  background: "#0a1628",
                  border: "1px solid #1e3a5f",
                  color: "#00d4ff",
                  fontFamily: "monospace",
                  fontSize: "10px",
                  padding: "1px 8px",
                  borderRadius: "2px",
                  cursor: "pointer",
                }}
              >
                {operators[index]}
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={addCondition}
        style={{
          background: "none",
          border: "1px dashed #1e3a5f",
          color: "#445566",
          fontFamily: "monospace",
          fontSize: "11px",
          padding: "3px 10px",
          borderRadius: "3px",
          cursor: "pointer",
          width: "100%",
          marginTop: "6px",
          marginBottom: "8px",
        }}
      >
        + добавить условие
      </button>

      <div
        style={{
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#4488ff",
          background: "#0a1628",
          border: "1px solid #1e3a5f",
          borderRadius: "2px",
          padding: "4px 8px",
          marginBottom: "8px",
        }}
      >
        👁 {formatConditions(conditions, operators, entities)}
      </div>

      <div style={{ display: "flex", gap: "6px" }}>
        <button
          onClick={() => onSave(conditions, operators)}
          style={{
            flex: 1,
            background: "#0a2a0a",
            border: "1px solid #1a5f1a",
            color: "#4caf50",
            fontFamily: "monospace",
            fontSize: "11px",
            padding: "4px",
            borderRadius: "3px",
            cursor: "pointer",
          }}
        >
          Сохранить
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            background: "#0a1628",
            border: "1px solid #1e3a5f",
            color: "#445566",
            fontFamily: "monospace",
            fontSize: "11px",
            padding: "4px",
            borderRadius: "3px",
            cursor: "pointer",
          }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

function ConditionRow({
  leaf,
  entities,
  onChange,
  onRemove,
}: {
  leaf: ConditionLeaf;
  entities: EntityMeta[];
  onChange: (updated: ConditionLeaf) => void;
  onRemove: () => void;
}) {
  function setLeft(left: FunctionCall) {
    onChange({ ...leaf, left });
  }
  function setRight(right: Operand) {
    onChange({ ...leaf, right });
  }
  function setOperator(operator: ConditionOperator) {
    onChange({ ...leaf, operator });
  }
  function setRightKind(kind: "number" | "function") {
    if (kind === leaf.right.kind) return;
    if (kind === "number") setRight({ kind: "number", value: 0 });
    else
      setRight({
        kind: "function",
        call: { fn: "Energy", args: [{ kind: "self" }] },
      });
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        marginBottom: "4px",
        flexWrap: "wrap",
      }}
    >
      <FunctionCallEditor
        value={leaf.left}
        entities={entities}
        onChange={setLeft}
      />

      <select
        style={{ ...selectStyle, width: "40px" }}
        value={leaf.operator}
        onChange={(e) => setOperator(e.target.value as ConditionOperator)}
      >
        {OPERATORS.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>

      <select
        style={selectStyle}
        value={leaf.right.kind}
        onChange={(e) => setRightKind(e.target.value as "number" | "function")}
      >
        <option value="number">число</option>
        <option value="function">функция</option>
      </select>

      {leaf.right.kind === "number" ? (
        <input
          type="number"
          style={inputStyle}
          value={leaf.right.value}
          onChange={(e) =>
            setRight({ kind: "number", value: Number(e.target.value) })
          }
        />
      ) : (
        <FunctionCallEditor
          value={leaf.right.call}
          entities={entities}
          onChange={(call) => setRight({ kind: "function", call })}
        />
      )}

      <button
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          color: "red",
          cursor: "pointer",
          fontSize: "14px",
          padding: "0 2px",
          lineHeight: 1,
          marginLeft: "auto",
        }}
        title="Удалить"
      >
        ×
      </button>
    </div>
  );
}
