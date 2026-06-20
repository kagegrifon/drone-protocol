import React, { useState } from "react";
import { useGameStore } from "../../../shared/store/gameStore.js";
import { CodeEditor } from "../CodeEditor/CodeEditor.js";

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

export function ProgramEditor() {
  const [tab, setTab] = useState<"drone" | "library" | "program">("drone");
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [newProgramName, setNewProgramName] = useState("");
  const [personalExpanded, setPersonalExpanded] = useState(true);
  const [assignedExpanded, setAssignedExpanded] = useState(true);
  const [highlightedProgramId, setHighlightedProgramId] = useState<
    string | null
  >(null);

  const selectedId = useGameStore((s) => s.selectedDroneId);
  const drones = useGameStore((s) => s.drones);
  const programs = useGameStore((s) => s.programs);
  const registry = useGameStore((s) => s.registry);
  const createProgram = useGameStore((s) => s.createProgram);
  const assignProgram = useGameStore((s) => s.assignProgram);
  const unassignProgram = useGameStore((s) => s.unassignProgram);
  const selectDrone = useGameStore((s) => s.selectDrone);
  const setProgramCodeSource = useGameStore((s) => s.setProgramCodeSource);

  const drone = drones.find((d) => d.id === selectedId);

  const personalProgram = drone
    ? registry.get(drone.personalProgramId)
    : undefined;
  const assignedProgram = drone?.assignedProgramId
    ? registry.get(drone.assignedProgramId)
    : undefined;

  // Дрон занят action-командой (не idle и не running) — показываем «⚡».
  const isDroneBusy =
    !!drone &&
    drone.programState !== "idle" &&
    drone.programState !== "running";

  // suppress unused warning — will be used in Phase 5 for scroll/highlight in library
  void highlightedProgramId;

  const editingProgram = editingProgramId
    ? (registry.get(editingProgramId) ?? null)
    : null;

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
                        marginBottom: assignedExpanded ? "8px" : 0,
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
                        onClick={() => setAssignedExpanded(!assignedExpanded)}
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
                        {assignedExpanded ? "▲" : "▼"}
                      </button>
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
                    {assignedExpanded && (
                      <>
                        <CodeEditor
                          value={assignedProgram.behavior.code}
                          onChange={(code) =>
                            setProgramCodeSource(assignedProgram.id, code)
                          }
                          height="240px"
                        />
                        {drone.codeError && (
                          <div
                            style={{
                              color: "#ff4444",
                              fontFamily: "monospace",
                              fontSize: "11px",
                              marginTop: "6px",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {drone.codeError}
                          </div>
                        )}
                      </>
                    )}
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
                      <>
                        <CodeEditor
                          value={personalProgram.behavior.code}
                          onChange={(code) =>
                            setProgramCodeSource(personalProgram.id, code)
                          }
                          height="240px"
                        />
                        {!assignedProgram && drone.codeError && (
                          <div
                            style={{
                              color: "#ff4444",
                              fontFamily: "monospace",
                              fontSize: "11px",
                              marginTop: "6px",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {drone.codeError}
                          </div>
                        )}
                      </>
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
                        color: isDroneBusy ? "#00ff88" : "#445566",
                      }}
                    >
                      <span>{isDroneBusy ? "⚡" : "◌"}</span>
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
                    data-testid={`program-edit-btn-${prog.id}`}
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
                  <CodeEditor
                    value={editingProgram.behavior.code}
                    onChange={(code) =>
                      setProgramCodeSource(editingProgramId!, code)
                    }
                    height="240px"
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
