import React, { useEffect, useState } from "react";
import { useGameStore } from "../../../shared/store/gameStore.js";
import { ProgramCodeBlock } from "../CodeEditor/ProgramCodeBlock.js";
import { updateModuleLibs } from "../CodeEditor/monacoSetup.js";
import { moduleInterfaceOf } from "../../../game/programs/moduleInterface.js";

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

const ERROR_COLOR = "#ff4444";

// Значок «⚠» рядом с именем программы, у которой есть ошибка исполнения.
function ErrorBadge({ message }: { message: string }) {
  return (
    <span title={message} style={{ color: ERROR_COLOR, fontSize: "12px" }}>
      ⚠
    </span>
  );
}

// Бейдж «exports» на программе с модульным интерфейсом — её можно импортировать.
function ExportsBadge({ names }: { names: string[] }) {
  return (
    <span
      title={`Экспортирует: ${names.join(", ")}`}
      style={{
        background: "#0d2040",
        border: "1px solid #2a5a8f",
        borderRadius: "2px",
        color: "#4488ff",
        fontFamily: "monospace",
        fontSize: "9px",
        padding: "1px 5px",
        letterSpacing: "0.5px",
      }}
    >
      exports
    </span>
  );
}

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

  // Перерегистрируем типы импортируемых модулей в Monaco при изменении программ.
  // Берём весь реестр (а не только library-programs), чтобы импорт резолвился по
  // любому slug; programs в зависимостях — сигнал, что код мог измениться.
  useEffect(() => {
    updateModuleLibs([...registry.values()]);
  }, [programs, registry]);

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

  const activeProgramId = drone
    ? (drone.assignedProgramId ?? drone.personalProgramId)
    : null;

  // Ошибка исполнения относится к активной программе дрона: assigned, если она
  // назначена, иначе personal. Только у активного блока показываем ⚠ и рамку.
  const codeError = drone?.codeError ?? null;
  const assignedHasError = !!assignedProgram && codeError !== null;
  const personalHasError =
    !assignedProgram && !!personalProgram && codeError !== null;

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
                  <div
                    style={BLOCK_STYLE(
                      true,
                      assignedHasError ? ERROR_COLOR : "#0088ff",
                    )}
                  >
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
                      {assignedHasError && codeError && (
                        <ErrorBadge message={codeError} />
                      )}
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
                      <ProgramCodeBlock
                        key={`assigned-${drone.id}-${assignedProgram.id}`}
                        code={assignedProgram.behavior.code}
                        onApply={(code) =>
                          setProgramCodeSource(assignedProgram.id, code)
                        }
                        height="240px"
                        highlightLine={
                          drone.assignedProgramId === activeProgramId
                            ? (drone.currentLine ?? null)
                            : null
                        }
                        codeError={drone.codeError ?? null}
                        affectedDroneIds={drones
                          .filter(
                            (d) => d.assignedProgramId === assignedProgram.id,
                          )
                          .map((d) => d.id)}
                      />
                    )}
                  </div>
                )}

                {/* Personal program block */}
                {personalProgram && (
                  <div
                    style={BLOCK_STYLE(
                      !assignedProgram,
                      personalHasError ? ERROR_COLOR : "#00ff88",
                    )}
                  >
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
                      {personalHasError && codeError && (
                        <ErrorBadge message={codeError} />
                      )}
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
                      <ProgramCodeBlock
                        key={`personal-${drone.id}-${personalProgram.id}`}
                        code={personalProgram.behavior.code}
                        onApply={(code) =>
                          setProgramCodeSource(personalProgram.id, code)
                        }
                        height="240px"
                        highlightLine={
                          drone.personalProgramId === activeProgramId
                            ? (drone.currentLine ?? null)
                            : null
                        }
                        codeError={
                          !assignedProgram ? (drone.codeError ?? null) : null
                        }
                        affectedDroneIds={[]}
                      />
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
            {programs.map((prog) => {
              const moduleInterface = moduleInterfaceOf(prog);
              const exportNames =
                moduleInterface?.exports.map((e) => e.name) ?? [];
              return (
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
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
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
                    {exportNames.length > 0 && (
                      <ExportsBadge names={exportNames} />
                    )}
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
              );
            })}
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
                  <ProgramCodeBlock
                    key={`program-${editingProgramId}`}
                    code={editingProgram.behavior.code}
                    onApply={(code) =>
                      setProgramCodeSource(editingProgramId!, code)
                    }
                    height="240px"
                    affectedDroneIds={drones
                      .filter((d) => d.assignedProgramId === editingProgramId)
                      .map((d) => d.id)}
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
