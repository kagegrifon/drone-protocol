import React from "react";
import type { StackFrame } from "../../../game/code/linker/mapLine.js";
import type { ProgramRegistry } from "../../../game/programs/types.js";

interface CallStackBreadcrumbsProps {
  frames: StackFrame[];
  /** Выбранный вручную кадр или null = follow (самый глубокий). */
  selectedIndex: number | null;
  onSelectFrame: (index: number) => void;
  registry: ProgramRegistry;
}

type CrumbRole = "normal" | "active" | "selected";

const CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  padding: "4px 8px",
  background: "#0a1628",
  borderBottom: "1px solid #1e3a5f",
};

const CRUMB_BASE_STYLE: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: "10px",
  padding: "2px 8px",
  borderRadius: "2px",
  border: "1px solid transparent",
  background: "transparent",
  cursor: "pointer",
};

// Стиль крошки по роли — lookup-record, без тернарников в разметке.
const CRUMB_ROLE_STYLE: Record<CrumbRole, React.CSSProperties> = {
  normal: { color: "#88aacc" },
  active: { color: "#00d4ff", background: "#0d2040" },
  selected: { color: "#00ff88", border: "1px solid #00ff88" },
};

const SEPARATOR_STYLE: React.CSSProperties = {
  color: "#445566",
  fontFamily: "monospace",
  fontSize: "10px",
};

function roleForCrumb({
  index,
  selectedIndex,
  deepestIndex,
}: {
  index: number;
  selectedIndex: number | null;
  deepestIndex: number;
}): CrumbRole {
  if (index === selectedIndex) return "selected";
  // follow-режим (ничего не выбрано) → активен самый глубокий кадр
  if (selectedIndex === null && index === deepestIndex) return "active";
  return "normal";
}

export function CallStackBreadcrumbs({
  frames,
  selectedIndex,
  onSelectFrame,
  registry,
}: CallStackBreadcrumbsProps) {
  const deepestIndex = frames.length - 1;

  return (
    <div data-testid="callstack-breadcrumbs" style={CONTAINER_STYLE}>
      {frames.map((frame, index) => {
        const programName = registry.get(frame.programId)?.name ?? frame.programId;
        const label = `${programName}:${frame.line}`;
        const role = roleForCrumb({ index, selectedIndex, deepestIndex });
        const isActive = role === "active";
        const isSelected = role === "selected";
        const showSeparator = index > 0;

        return (
          <React.Fragment key={index}>
            {showSeparator && <span style={SEPARATOR_STYLE}>▸</span>}
            <button
              data-testid={`callstack-crumb-${index}`}
              aria-current={isActive ? "true" : undefined}
              aria-selected={isSelected ? "true" : undefined}
              onClick={() => onSelectFrame(index)}
              style={{ ...CRUMB_BASE_STYLE, ...CRUMB_ROLE_STYLE[role] }}
            >
              {label}
            </button>
          </React.Fragment>
        );
      })}
      {/* Резерв справа под debug-контролы этапа B (Step into / over / Continue). */}
      <div style={{ flex: 1 }} />
    </div>
  );
}
