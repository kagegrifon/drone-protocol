import React, { useMemo, useState } from "react";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type {
  Instruction,
  FlowBlock,
  ConditionLeaf,
  ConditionLogic,
} from "../../game/programs/types.js";
import type { EntityMeta } from "../../game/missions/types.js";
import { useGameStore } from "../../shared/store/gameStore.js";
import {
  makeDefaultInstruction,
  AddInstructionMenu,
} from "./instructionUtils.js";
import { ConditionEditor } from "./ConditionEditor.js";
import { formatConditions } from "./conditionFormat.js";
import { DropSlot } from "./DropSlot.js";

export type DragItemData = {
  programId: string;
  path: number[];
};

export const ICONS: Record<string, string> = {
  MOVE_TO: "→",
  MINE: "⛏",
  DROP: "↓",
  CHARGE: "⚡",
  WAIT: "⏱",
  LOOP: "🔄",
  REPEAT: "↩",
  WHILE: "↺",
  IF: "?",
  RUN_PROGRAM: "▶",
};

interface Props {
  instruction: Instruction;
  programId: string;
  path: number[];
  entities: EntityMeta[];
  programIds: string[];
  activeInstructionPath: number[] | null;
  isDragging?: boolean;
}

export function InstructionBlock({
  instruction,
  programId,
  path,
  entities,
  programIds,
  activeInstructionPath,
  isDragging,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const removeInstruction = useGameStore((s) => s.removeInstruction);
  const addInstruction = useGameStore((s) => s.addInstruction);
  const updateInstruction = useGameStore((s) => s.updateInstruction);

  const [hovered, setHovered] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSelfDragging,
  } = useSortable({
    id: path.join("-"),
    data: { programId, path } as DragItemData,
  });

  const cardStyle = useMemo<React.CSSProperties>(() => {
    const isActive =
      activeInstructionPath !== null &&
      path.length === activeInstructionPath.length &&
      path.every((v, i) => v === activeInstructionPath[i]);

    return {
      background: isActive ? "#00ff8812" : "#060f1e",
      borderRadius: "4px",
      padding: "6px 8px",
      marginBottom: "4px",
      fontFamily: "monospace",
      fontSize: "12px",
    };
  }, [activeInstructionPath, path]);

  const isContainer =
    instruction.type === "LOOP" ||
    instruction.type === "REPEAT" ||
    instruction.type === "WHILE" ||
    instruction.type === "IF";
  const children: Instruction[] =
    instruction.type === "LOOP" ||
    instruction.type === "REPEAT" ||
    instruction.type === "WHILE"
      ? instruction.body
      : instruction.type === "IF"
        ? instruction.then
        : [];

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      style={{
        ...cardStyle,
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
        opacity: isSelfDragging ? 0.3 : 1,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexWrap: "wrap",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span
          {...listeners}
          style={{
            color: "#4488ff",
            cursor: "grab",
            fontSize: "14px",
            visibility: hovered ? "visible" : "hidden",
            userSelect: "none",
            flexShrink: 0,
          }}
        >
          ⠿
        </span>
        <span style={{ color: "#4488ff", fontSize: "14px" }}>
          {ICONS[instruction.type] ?? "•"}
        </span>
        <span style={{ color: "#00d4ff" }}>{instruction.type}</span>

        {instruction.type === "MOVE_TO" &&
          (() => {
            const label =
              entities.find((e) => e.id === instruction.targetEntityId)
                ?.label ?? `#${instruction.targetEntityId}`;
            return (
              <button
                data-testid="move-to-toggle"
                onClick={() => setPickerOpen((p) => !p)}
                style={{
                  background: "#0a1628",
                  border: `1px solid ${pickerOpen ? "#00d4ff" : "#1e3a5f"}`,
                  color: "#aabbcc",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "2px",
                  cursor: "pointer",
                }}
              >
                {label} {pickerOpen ? "▴" : "▾"}
              </button>
            );
          })()}

        {(instruction.type === "IF" || instruction.type === "WHILE") &&
          (() => {
            const noConditions = instruction.conditions.length === 0;
            const label = noConditions
              ? null
              : formatConditions(
                  instruction.conditions,
                  instruction.operators,
                  entities,
                  /* compact */ true,
                );
            return (
              <>
                {noConditions ? (
                  <button
                    onClick={() => setEditorOpen((o) => !o)}
                    style={{
                      background: "none",
                      border: "1px solid #1e3a5f",
                      color: "#445566",
                      fontFamily: "monospace",
                      fontSize: "10px",
                      padding: "1px 6px",
                      borderRadius: "2px",
                      cursor: "pointer",
                    }}
                  >
                    ✏️ задать
                  </button>
                ) : (
                  <span
                    style={{
                      background: "#0a2040",
                      color: "#4488ff",
                      fontFamily: "monospace",
                      fontSize: "10px",
                      padding: "1px 6px",
                      borderRadius: "3px",
                      border: "1px solid #1e3a5f",
                    }}
                  >
                    {label}
                  </span>
                )}
              </>
            );
          })()}

        {instruction.type !== "MOVE_TO" &&
          instruction.type !== "IF" &&
          instruction.type !== "WHILE" && (
            <InstructionParams
              instruction={instruction}
              programIds={programIds}
            />
          )}

        <button
          onClick={() => removeInstruction(programId, path)}
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
          title="Remove"
        >
          ×
        </button>
      </div>

      {(instruction.type === "IF" || instruction.type === "WHILE") &&
        editorOpen && (
          <ConditionEditor
            conditions={instruction.conditions}
            operators={instruction.operators}
            entities={entities}
            onSave={(
              conditions: ConditionLeaf[],
              operators: ConditionLogic[],
            ) => {
              updateInstruction(programId, path, {
                ...instruction,
                conditions,
                operators,
              });
              setEditorOpen(false);
            }}
            onCancel={() => setEditorOpen(false)}
          />
        )}

      {instruction.type === "MOVE_TO" && pickerOpen && (
        <div
          style={{
            marginTop: "6px",
            paddingLeft: "12px",
            borderLeft: "1px solid #1e3a5f",
          }}
        >
          {entities.map(({ id, label }) => (
            <button
              key={id}
              data-testid={`move-to-option-${label}`}
              onClick={() => {
                updateInstruction(programId, path, {
                  type: "MOVE_TO",
                  targetEntityId: id,
                });
                setPickerOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background:
                  id === instruction.targetEntityId ? "#0d2040" : "none",
                border: "1px solid",
                borderColor:
                  id === instruction.targetEntityId ? "#00d4ff" : "#1e3a5f",
                color:
                  id === instruction.targetEntityId ? "#00d4ff" : "#aabbcc",
                fontFamily: "monospace",
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "3px",
                cursor: "pointer",
                marginBottom: "3px",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isContainer && (
        <div
          style={{
            marginTop: "6px",
            paddingLeft: "12px",
            borderLeft: "2px solid #1e3a5f",
          }}
        >
          {children.length === 0 ? (
            <DropSlot
              programId={programId}
              containerPath={path}
              insertIndex={0}
              isDragging={isDragging ?? false}
              variant="empty"
            />
          ) : (
            <SortableContext
              items={children.map((_, i) => [...path, i].join("-"))}
              strategy={verticalListSortingStrategy}
            >
              <DropSlot
                programId={programId}
                containerPath={path}
                insertIndex={0}
                isDragging={isDragging ?? false}
              />
              {children.map((child, i) => (
                <React.Fragment key={[...path, i].join("-")}>
                  <InstructionBlock
                    instruction={child}
                    programId={programId}
                    path={[...path, i]}
                    entities={entities}
                    programIds={programIds}
                    activeInstructionPath={activeInstructionPath}
                    isDragging={isDragging}
                  />
                  <DropSlot
                    programId={programId}
                    containerPath={path}
                    insertIndex={i + 1}
                    isDragging={isDragging ?? false}
                  />
                </React.Fragment>
              ))}
            </SortableContext>
          )}
          <AddInstructionMenu
            onAdd={(type) => {
              addInstruction(
                programId,
                makeDefaultInstruction(type, entities, programIds),
                path,
              );
            }}
          />
        </div>
      )}
    </div>
  );
}

function InstructionParams({
  instruction,
  programIds,
}: {
  instruction: Instruction;
  programIds: string[];
}) {
  const style: React.CSSProperties = {
    background: "#0a1628",
    border: "1px solid #1e3a5f",
    color: "#aabbcc",
    fontFamily: "monospace",
    fontSize: "11px",
    padding: "2px 4px",
    borderRadius: "2px",
  };

  if (instruction.type === "WAIT") {
    return (
      <span style={{ color: "#778899", fontSize: "11px" }}>
        {instruction.seconds}s
      </span>
    );
  }

  if (instruction.type === "REPEAT") {
    return (
      <span style={{ color: "#778899", fontSize: "11px" }}>
        ×{(instruction as FlowBlock & { type: "REPEAT" }).count}
      </span>
    );
  }

  if (instruction.type === "RUN_PROGRAM") {
    return (
      <span style={{ color: "#778899", fontSize: "11px" }}>
        {(instruction as FlowBlock & { type: "RUN_PROGRAM" }).programId}
      </span>
    );
  }

  void style;
  void programIds;
  return null;
}
