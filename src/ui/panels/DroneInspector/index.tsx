import { memo, useEffect, useRef, useState } from "react";
import { useGameStore } from "../../../shared/store/gameStore.js";
import type {
  BuildingState,
  SelectedCell,
} from "../../../shared/store/gameStore.js";

const COPIED_FEEDBACK_MS = 1200;

function Bar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      style={{
        height: "6px",
        background: "#0a1a2a",
        borderRadius: "3px",
        overflow: "hidden",
        flex: 1,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: "3px",
          transition: "width 0.1s",
        }}
      />
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "8px",
      }}
    >
      <span
        style={{
          color: "#445566",
          fontFamily: "monospace",
          fontSize: "11px",
          width: "72px",
          flexShrink: 0,
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

const BTN: React.CSSProperties = {
  background: "#0a1628",
  border: "1px solid #1e3a5f",
  color: "#aabbcc",
  fontFamily: "monospace",
  fontSize: "13px",
  padding: "4px 10px",
  borderRadius: "3px",
  cursor: "pointer",
  lineHeight: 1,
};

const DroneControls = memo(function DroneControls({
  droneId,
  localPaused,
}: {
  droneId: number;
  localPaused: boolean;
}) {
  const startDrone = useGameStore((s) => s.startDrone);
  const pauseDrone = useGameStore((s) => s.pauseDrone);
  const resetDrone = useGameStore((s) => s.resetDrone);

  return (
    <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
      <button
        data-testid="drone-play-pause"
        style={BTN}
        onClick={() =>
          localPaused ? startDrone(droneId) : pauseDrone(droneId)
        }
        title={localPaused ? "Resume drone" : "Pause drone"}
      >
        {localPaused ? "▶" : "⏸"}
      </button>
      <button
        data-testid="drone-reset"
        style={BTN}
        onClick={() => resetDrone(droneId)}
        title="Reset drone program"
      >
        ↺
      </button>
    </div>
  );
});

const COPY_BTN: React.CSSProperties = {
  background: "#0d2040",
  border: "1px solid #1a3a5a",
  color: "#4a8aaa",
  borderRadius: "3px",
  padding: "2px 8px",
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: "12px",
  lineHeight: 1,
};

const MONO: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: "12px",
};

function CellInspector({ cell }: { cell: { x: number; y: number } }) {
  const buildings = useGameStore((s) => s.buildings);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const building = buildings.find((b) => b.x === cell.x && b.y === cell.y);
  const copyText = `{ x: ${cell.x}, y: ${cell.y} }`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(
      () => setCopied(false),
      COPIED_FEEDBACK_MS,
    );
  };

  return (
    <div data-testid="cell-inspector" style={{ padding: "12px" }}>
      <div
        style={{
          color: "#c0cfe0",
          fontFamily: "monospace",
          fontSize: "13px",
          marginBottom: "12px",
          borderBottom: "1px solid #1e3a5f",
          paddingBottom: "8px",
        }}
      >
        Cell
      </div>

      <Row label="POS">
        <span
          data-testid="cell-inspector-pos"
          style={{ ...MONO, color: "#00d4ff" }}
        >
          x: {cell.x} y: {cell.y}
        </span>
        <button
          data-testid="cell-inspector-copy"
          style={COPY_BTN}
          onClick={handleCopy}
          title="Скопировать координаты"
        >
          {copied ? "✓" : "⧉"}
        </button>
      </Row>

      {building && <BuildingRows building={building} />}
    </div>
  );
}

function BuildingRows({ building }: { building: BuildingState }) {
  return (
    <>
      <Row label="REF">
        <span
          data-testid="cell-inspector-ref"
          style={{ ...MONO, color: "#4488ff" }}
        >
          {building.ref}
        </span>
      </Row>
      {building.type === "mine" && (
        <Row label="ORE">
          <span
            data-testid="cell-inspector-ore"
            style={{ ...MONO, color: "#00ff88" }}
          >
            {building.oreRemaining}
          </span>
        </Row>
      )}
    </>
  );
}

function InspectorEmpty() {
  return (
    <div
      data-testid="drone-inspector-empty"
      style={{
        padding: "16px 12px",
        color: "#445566",
        fontFamily: "monospace",
        fontSize: "12px",
        textAlign: "center",
      }}
    >
      Select a drone
    </div>
  );
}

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
