import React, { useState } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useGameStore } from "../../../shared/store/gameStore.js";
import {
  InstructionBlock,
  type DragItemData,
  ICONS,
} from "./InstructionBlock.js";
import {
  makeDefaultInstruction,
  AddInstructionMenu,
} from "./instructionUtils.js";
import { DropSlot, type SlotData } from "./DropSlot.js";
import type { Instruction, ProgramDef } from "../../../game/programs/types.js";
import type { EntityMeta } from "../../../game/missions/types.js";

const TAB_BTN = (active: boolean): React.CSSProperties => ({
  background: active ? "#0d2040" : "transparent",
  border: "none",
  borderBottom: active ? "2px solid #00d4ff" : "2px solid transparent",
  color: active ? "#00d4ff" : "#445566",
  fontFamily: "monospace",
  fontSize: "12px",
  padding: "6px 14px",
  cursor: "pointer",
  letterSpacing: "0.5px",
});

const BLOCK_STYLE = (active: boolean, color: string): React.CSSProperties => ({
  background: "#060f1e",
  border: `1px solid ${active ? color : "#1e3a5f"}`,
  borderRadius: "4px",
  padding: "8px 10px",
  marginBottom: "8px",
});

const RADIO_STYLE = (checked: boolean): React.CSSProperties => ({
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  border: `2px solid ${checked ? "#00ff88" : "#445566"}`,
  background: checked ? "#00ff88" : "transparent",
  cursor: checked ? "default" : "pointer",
  flexShrink: 0,
});

function getInstructionByPath(prog: ProgramDef, path: number[]) {
  let list = prog.instructions;
  for (let i = 0; i < path.length - 1; i++) {
    const node = list[path[i]];
    if (!node) return null;
    if (node.type === "LOOP" || node.type === "REPEAT" || node.type === "WHILE") list = node.body;
    else if (node.type === "IF") list = node.then;
    else return null;
  }
  return list[path[path.length - 1]] ?? null;
}

export function ProgramEditor({ entities }: { entities: EntityMeta[] }) {
  const [tab, setTab] = useState<"drone" | "library" | "program">("drone");
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [newProgramName, setNewProgramName] = useState("");
  const [personalExpanded, setPersonalExpanded] = useState(true);
  const [highlightedProgramId, setHighlightedProgramId] = useState<
    string | null
  >(null);

  const selectedId = useGameStore((s) => s.selectedDroneId);
  const drones = useGameStore((s) => s.drones);
  const programs = useGameStore((s) => s.programs);
  const registry = useGameStore((s) => s.registry);
  const addInstruction = useGameStore((s) => s.addInstruction);
  const createProgram = useGameStore((s) => s.createProgram);
  const assignProgram = useGameStore((s) => s.assignProgram);
  const unassignProgram = useGameStore((s) => s.unassignProgram);
  const selectDrone = useGameStore((s) => s.selectDrone);
  const moveInstruction = useGameStore((s) => s.moveInstruction);
  const [activeDragData, setActiveDragData] = useState<DragItemData | null>(
    null,
  );

  const drone = drones.find((d) => d.id === selectedId);
  const programIds = programs.map((p) => p.id);

  const personalProgram = drone
    ? registry.get(drone.personalProgramId)
    : undefined;
  const assignedProgram = drone?.assignedProgramId
    ? registry.get(drone.assignedProgramId)
    : undefined;

  const handleAddPersonal = (type: Instruction["type"]) => {
    if (!personalProgram) return;
    const instr = makeDefaultInstruction(type, entities, programIds);
    addInstruction(personalProgram.id, instr);
  };

  // suppress unused warning — will be used in Phase 5 for scroll/highlight in library
  void highlightedProgramId;

  const editingProgram = editingProgramId
    ? (registry.get(editingProgramId) ?? null)
    : null;

  function handleDragStart({ active }: DragStartEvent) {
    setActiveDragData(active.data.current as DragItemData);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDragData(null);
    if (!over || active.id === over.id) return;

    const { programId, path: fromPath } = active.data.current as DragItemData;
    const overData = over.data.current;

    if (overData?.type === "slot") {
      const { containerPath, insertIndex } = overData as SlotData;
      const fromContainerPath = fromPath.slice(0, -1);
      const fromIndex = fromPath[fromPath.length - 1];
      if (
        containerPath.join() === fromContainerPath.join() &&
        (insertIndex === fromIndex || insertIndex === fromIndex + 1)
      )
        return;
      moveInstruction(programId, fromPath, containerPath, insertIndex);
      return;
    }

    // Fallback: drop на инструкцию
    const { path: overPath } = overData as DragItemData;
    const toContainerPath = overPath.slice(0, -1);
    const toIndex = overPath[overPath.length - 1];
    const fromContainerPath = fromPath.slice(0, -1);
    const fromIndex = fromPath[fromPath.length - 1];
    if (
      toContainerPath.join() !== fromContainerPath.join() ||
      toIndex !== fromIndex
    ) {
      moveInstruction(programId, fromPath, toContainerPath, toIndex);
    }
  }

  function renderDragOverlay() {
    if (!activeDragData) return null;
    const prog = registry.get(activeDragData.programId);
    if (!prog) return null;
    const instr = getInstructionByPath(prog, activeDragData.path);
    if (!instr) return null;
    return (
      <div
        style={{
          background: "#060f1e",
          border: "1px solid #00d4ff",
          borderRadius: "4px",
          padding: "6px 8px",
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#00d4ff",
          opacity: 0.85,
          boxShadow: "0 0 8px #00d4ff44",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span style={{ color: "#4488ff" }}>{ICONS[instr.type] ?? "•"}</span>
        <span>{instr.type}</span>
      </div>
    );
  }

  const handleAddToEditing = (type: Instruction["type"]) => {
    if (!editingProgramId) return;
    const instr = makeDefaultInstruction(type, entities, programIds);
    addInstruction(editingProgramId, instr);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #1e3a5f",
          flexShrink: 0,
        }}
      >
        <button
          style={TAB_BTN(tab === "drone")}
          onClick={() => setTab("drone")}
        >
          DRONE
        </button>
        <button
          style={TAB_BTN(tab === "library")}
          onClick={() => setTab("library")}
        >
          LIBRARY
        </button>
        <button
          style={TAB_BTN(tab === "program")}
          onClick={() => setTab("program")}
        >
          PROGRAM
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
        {tab === "drone" && (
          <>
            {!drone && (
              <div
                style={{
                  color: "#445566",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  textAlign: "center",
                  paddingTop: "16px",
                }}
              >
                Select a drone
              </div>
            )}
            {drone && (
              <>
                {/* Assigned program block — only if present */}
                {assignedProgram && (
                  <div style={BLOCK_STYLE(true, "#0088ff")}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <div
                        style={RADIO_STYLE(true)}
                        title="Активная программа"
                      />
                      <span
                        style={{
                          color: "#4488ff",
                          fontFamily: "monospace",
                          fontSize: "11px",
                          flex: 1,
                        }}
                      >
                        {assignedProgram.name}
                      </span>
                      <button
                        onClick={() => {
                          setHighlightedProgramId(drone.assignedProgramId!);
                          setTab("library");
                        }}
                        title="Открыть в библиотеке"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#4488ff",
                          cursor: "pointer",
                          fontFamily: "monospace",
                          fontSize: "12px",
                          padding: "0 4px",
                        }}
                      >
                        ↗
                      </button>
                    </div>
                  </div>
                )}

                {/* Personal program block */}
                {personalProgram && (
                  <div style={BLOCK_STYLE(!assignedProgram, "#00ff88")}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: personalExpanded ? "8px" : 0,
                      }}
                    >
                      <div
                        style={RADIO_STYLE(!assignedProgram)}
                        title={
                          assignedProgram
                            ? "Переключить на персональную"
                            : "Активная программа"
                        }
                        onClick={() => {
                          if (assignedProgram) unassignProgram(drone.id);
                        }}
                      />
                      <span
                        style={{
                          color: !assignedProgram ? "#00ff88" : "#445566",
                          fontFamily: "monospace",
                          fontSize: "11px",
                          flex: 1,
                        }}
                      >
                        {personalProgram.name}
                      </span>
                      <button
                        onClick={() => setPersonalExpanded(!personalExpanded)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#445566",
                          cursor: "pointer",
                          fontFamily: "monospace",
                          fontSize: "11px",
                          padding: "0 4px",
                        }}
                      >
                        {personalExpanded ? "▲" : "▼"}
                      </button>
                    </div>
                    {personalExpanded && (
                      <DndContext
                        collisionDetection={pointerWithin}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={personalProgram.instructions.map((_, i) =>
                            String(i),
                          )}
                          strategy={verticalListSortingStrategy}
                        >
                          <DropSlot
                            programId={personalProgram.id}
                            containerPath={[]}
                            insertIndex={0}
                            isDragging={activeDragData !== null}
                          />
                          {personalProgram.instructions.map((instr, i) => (
                            <React.Fragment key={String(i)}>
                              <InstructionBlock
                                instruction={instr}
                                programId={personalProgram.id}
                                path={[i]}
                                entities={entities}
                                programIds={programIds}
                                activeInstructionPath={
                                  !assignedProgram
                                    ? (drone.currentInstructionPath ?? null)
                                    : null
                                }
                                isDragging={activeDragData !== null}
                              />
                              <DropSlot
                                programId={personalProgram.id}
                                containerPath={[]}
                                insertIndex={i + 1}
                                isDragging={activeDragData !== null}
                              />
                            </React.Fragment>
                          ))}
                        </SortableContext>
                        <AddInstructionMenu onAdd={handleAddPersonal} />
                        <DragOverlay dropAnimation={null}>
                          {renderDragOverlay()}
                        </DragOverlay>
                      </DndContext>
                    )}
                  </div>
                )}

                {/* No assigned program — show status and assign button */}
                {!assignedProgram && (
                  <>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "5px 8px",
                        marginTop: "4px",
                        borderTop: "1px solid #1e3a5f",
                        fontFamily: "monospace",
                        fontSize: "11px",
                        color: drone.waitingFor ? "#00ff88" : "#445566",
                      }}
                    >
                      <span>{drone.waitingFor ? "⚡" : "◌"}</span>
                      <span>{drone.currentInstruction}</span>
                    </div>
                    <button
                      onClick={() => setTab("library")}
                      style={{
                        width: "100%",
                        marginTop: "8px",
                        background: "#0a1628",
                        border: "1px solid #1e3a5f",
                        color: "#4488ff",
                        fontFamily: "monospace",
                        fontSize: "11px",
                        padding: "6px",
                        cursor: "pointer",
                        borderRadius: "3px",
                        textAlign: "left",
                      }}
                    >
                      Назначить программу из библиотеки →
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}

        {tab === "library" && (
          <>
            {programs.map((prog) => (
              <div
                key={prog.id}
                style={{
                  background: "#060f1e",
                  border: "1px solid #1e3a5f",
                  borderRadius: "4px",
                  padding: "8px 10px",
                  marginBottom: "6px",
                  fontFamily: "monospace",
                  fontSize: "12px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <button
                    onClick={() => {
                      setEditingProgramId(prog.id);
                      setTab("program");
                    }}
                    style={{
                      color: "#c0cfe0",
                      flexShrink: 0,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "monospace",
                      fontSize: "12px",
                      padding: 0,
                    }}
                  >
                    {prog.name}
                  </button>
                  {selectedId !== null && (
                    <button
                      onClick={() => assignProgram(selectedId, prog.id)}
                      style={{
                        background: "#0a1628",
                        border: "1px solid #1e3a5f",
                        color: "#00ff88",
                        fontFamily: "monospace",
                        fontSize: "10px",
                        padding: "2px 8px",
                        cursor: "pointer",
                        borderRadius: "2px",
                      }}
                    >
                      Assign
                    </button>
                  )}
                </div>
                {(() => {
                  const assignedDrones = drones.filter(
                    (d) => d.assignedProgramId === prog.id,
                  );
                  return assignedDrones.length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "4px",
                        marginTop: "6px",
                      }}
                    >
                      <span
                        style={{
                          color: "#445566",
                          fontFamily: "monospace",
                          fontSize: "10px",
                          alignSelf: "center",
                        }}
                      >
                        назначена:
                      </span>
                      {assignedDrones.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => {
                            selectDrone(d.id);
                            setTab("drone");
                          }}
                          style={{
                            background: "#0d2040",
                            border: "1px solid #1e3a5f",
                            color: "#4488ff",
                            fontFamily: "monospace",
                            fontSize: "10px",
                            padding: "1px 6px",
                            cursor: "pointer",
                            borderRadius: "2px",
                          }}
                        >
                          drone-{d.id} ↗
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
            ))}
            <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
              <input
                value={newProgramName}
                onChange={(e) => setNewProgramName(e.target.value)}
                placeholder="program name"
                style={{
                  flex: 1,
                  background: "#060f1e",
                  border: "1px solid #1e3a5f",
                  color: "#c0cfe0",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  padding: "4px 8px",
                  borderRadius: "3px",
                }}
              />
              <button
                onClick={() => {
                  if (newProgramName.trim()) {
                    createProgram(newProgramName.trim());
                    setNewProgramName("");
                  }
                }}
                style={{
                  background: "#0a1628",
                  border: "1px solid #1e3a5f",
                  color: "#00d4ff",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  padding: "4px 10px",
                  cursor: "pointer",
                  borderRadius: "3px",
                }}
              >
                + New
              </button>
            </div>
          </>
        )}

        {tab === "program" && (
          <>
            {!editingProgram ? (
              <div
                style={{
                  textAlign: "center",
                  paddingTop: "30px",
                  color: "#445566",
                  fontFamily: "monospace",
                  fontSize: "11px",
                }}
              >
                <div
                  style={{
                    fontSize: "20px",
                    color: "#1e3a5f",
                    marginBottom: "8px",
                  }}
                >
                  ✏
                </div>
                <div style={{ color: "#88aacc", marginBottom: "4px" }}>
                  Программа не выбрана
                </div>
                <div>
                  Создай программу в LIBRARY
                  <br />и нажми Edit
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    background: "#060f1e",
                    border: "1px solid #1e3a5f",
                    borderRadius: "4px",
                    padding: "8px 10px",
                    marginBottom: "6px",
                    fontFamily: "monospace",
                    fontSize: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span style={{ color: "#c0cfe0", flex: 1 }}>
                      {editingProgram.name}
                    </span>
                    {selectedId !== null && (
                      <button
                        onClick={() =>
                          assignProgram(selectedId, editingProgramId!)
                        }
                        style={{
                          background: "#0a1628",
                          border: "1px solid #1e3a5f",
                          color: "#00ff88",
                          fontFamily: "monospace",
                          fontSize: "10px",
                          padding: "2px 8px",
                          cursor: "pointer",
                          borderRadius: "2px",
                        }}
                      >
                        Assign
                      </button>
                    )}
                  </div>
                  {(() => {
                    const assignedDrones = drones.filter(
                      (d) => d.assignedProgramId === editingProgramId,
                    );
                    return assignedDrones.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "4px",
                          marginTop: "6px",
                        }}
                      >
                        <span
                          style={{
                            color: "#445566",
                            fontFamily: "monospace",
                            fontSize: "10px",
                            alignSelf: "center",
                          }}
                        >
                          назначена:
                        </span>
                        {assignedDrones.map((d) => (
                          <button
                            key={d.id}
                            onClick={() => {
                              selectDrone(d.id);
                              setTab("drone");
                            }}
                            style={{
                              background: "#0d2040",
                              border: "1px solid #1e3a5f",
                              color: "#4488ff",
                              fontFamily: "monospace",
                              fontSize: "10px",
                              padding: "1px 6px",
                              cursor: "pointer",
                              borderRadius: "2px",
                            }}
                          >
                            drone-{d.id} ↗
                          </button>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
                <div
                  style={{ borderTop: "1px solid #1e3a5f", paddingTop: "8px" }}
                >
                  <DndContext
                    collisionDetection={pointerWithin}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={editingProgram.instructions.map((_, i) =>
                        String(i),
                      )}
                      strategy={verticalListSortingStrategy}
                    >
                      <DropSlot
                        programId={editingProgramId!}
                        containerPath={[]}
                        insertIndex={0}
                        isDragging={activeDragData !== null}
                      />
                      {editingProgram.instructions.map((instr, i) => (
                        <React.Fragment key={String(i)}>
                          <InstructionBlock
                            instruction={instr}
                            programId={editingProgramId!}
                            path={[i]}
                            entities={entities}
                            programIds={programIds}
                            activeInstructionPath={null}
                            isDragging={activeDragData !== null}
                          />
                          <DropSlot
                            programId={editingProgramId!}
                            containerPath={[]}
                            insertIndex={i + 1}
                            isDragging={activeDragData !== null}
                          />
                        </React.Fragment>
                      ))}
                    </SortableContext>
                    <AddInstructionMenu onAdd={handleAddToEditing} />
                    <DragOverlay dropAnimation={null}>
                      {renderDragOverlay()}
                    </DragOverlay>
                  </DndContext>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
