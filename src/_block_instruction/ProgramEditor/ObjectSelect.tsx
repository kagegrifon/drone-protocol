import type { ObjectRef } from "../../game/programs/types.js";
import type { EntityMeta } from "../../game/missions/types.js";

const selectStyle: React.CSSProperties = {
  background: "#0a1628",
  border: "1px solid #1e3a5f",
  color: "#aabbcc",
  fontFamily: "monospace",
  fontSize: "11px",
  padding: "2px 4px",
  borderRadius: "2px",
};

interface Props {
  value: ObjectRef;
  entities: EntityMeta[];
  // Фильтр по типу — например, для Deposit показываем только Mine'ы.
  // Получает EntityMeta, возвращает true, если опция допустима.
  filter?: (entity: EntityMeta) => boolean;
  label?: string;
  onChange: (next: ObjectRef) => void;
}

export function ObjectSelect({
  value,
  entities,
  filter,
  label,
  onChange,
}: Props) {
  const filtered = filter ? entities.filter(filter) : entities;
  const stringValue = value.kind === "self" ? "__self__" : String(value.id);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
      {label && (
        <span
          style={{
            color: "#445566",
            fontFamily: "monospace",
            fontSize: "10px",
          }}
        >
          {label}:
        </span>
      )}
      <select
        style={selectStyle}
        value={stringValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__self__") onChange({ kind: "self" });
          else onChange({ kind: "entity", id: Number(v) });
        }}
      >
        <option value="__self__">Self</option>
        {filtered.map(({ id, label: l }) => (
          <option key={id} value={id}>
            {l}
          </option>
        ))}
      </select>
    </span>
  );
}
