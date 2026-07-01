import { useGameStore } from "../../../shared/store/gameStore.js";
import type { SelectedCell } from "../../../shared/store/gameStore.js";
import { Bar } from "./Bar.js";
import { Row } from "./Row.js";
import { DroneControls } from "./DroneControls.js";
import { CellInspector } from "./CellInspector.js";
import { InspectorEmpty } from "./InspectorEmpty.js";

function renderNonDrone(selectedCell: SelectedCell) {
  if (selectedCell === null) return <InspectorEmpty />;
  return <CellInspector cell={selectedCell} />;
}

export function DroneInspector() {
  const selectedId = useGameStore((s) => s.selectedDroneId);
  const selectedCell = useGameStore((s) => s.selectedCell);
  const drones = useGameStore((s) => s.drones);
  const drone = drones.find((d) => d.id === selectedId);

  // Выбор дрона и клетки взаимоисключающи (гарантируется store). Приоритет:
  // дрон → клетка → пусто.
  if (!drone) {
    return renderNonDrone(selectedCell);
  }

  const stateColor =
    drone.programState === "running"
      ? "#00d4ff"
      : drone.programState !== "idle"
        ? "#ffd700"
        : "#445566";

  return (
    <div style={{ padding: "12px" }}>
      <div
        style={{
          color: "#c0cfe0",
          fontFamily: "monospace",
          fontSize: "13px",
          marginBottom: "12px",
          borderBottom: "1px solid #1e3a5f",
          paddingBottom: "8px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <span>Drone #{drone.id}</span>
        <span
          style={{ color: stateColor, fontSize: "11px", letterSpacing: "1px" }}
        >
          {drone.programState.toUpperCase()}
        </span>
        {drone.localPaused && (
          <span
            data-testid="local-paused-badge"
            style={{ color: "#ff8844", fontSize: "11px", letterSpacing: "1px" }}
          >
            [LOCAL PAUSED]
          </span>
        )}
      </div>

      <DroneControls droneId={drone.id} localPaused={drone.localPaused} />

      <Row label="ENERGY">
        <Bar
          value={drone.energy.current}
          max={drone.energy.max}
          color="#00d4ff"
        />
        <span
          style={{
            color: "#aabbcc",
            fontFamily: "monospace",
            fontSize: "11px",
            whiteSpace: "nowrap",
          }}
        >
          {Math.round(drone.energy.current)}/{drone.energy.max}
        </span>
      </Row>

      <Row label="ORE">
        <Bar
          value={drone.inventory.ore}
          max={drone.inventory.capacity}
          color="#00ff88"
        />
        <span
          style={{
            color: "#aabbcc",
            fontFamily: "monospace",
            fontSize: "11px",
            whiteSpace: "nowrap",
          }}
        >
          {drone.inventory.ore}/{drone.inventory.capacity}
        </span>
      </Row>

      <Row label="TASK">
        <span
          style={{
            color: "#ffd700",
            fontFamily: "monospace",
            fontSize: "12px",
          }}
        >
          {drone.currentInstruction}
        </span>
      </Row>

      <Row label="PROGRAM">
        <span
          style={{
            color: "#4488ff",
            fontFamily: "monospace",
            fontSize: "12px",
          }}
        >
          {drone.currentProgramId ?? "—"}
        </span>
      </Row>

      <Row label="POS">
        <span
          style={{
            color: "#778899",
            fontFamily: "monospace",
            fontSize: "11px",
          }}
        >
          {drone.position.x}, {drone.position.y}
        </span>
      </Row>
    </div>
  );
}
