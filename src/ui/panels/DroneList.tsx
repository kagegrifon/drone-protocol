import { useGameStore } from "../../shared/store/gameStore.js";
import type { DroneState } from "../../shared/store/gameStore.js";

const ERROR_COLOR = "#ff4444";

function statusColor(state: DroneState["programState"]): string {
  switch (state) {
    case "running":
      return "#00d4ff";
    case "move":
    case "mine":
    case "drop":
    case "charge":
      return "#ffd700";
    case "idle":
      return "#445566";
  }
}

function statusLabel(state: DroneState["programState"]): string {
  switch (state) {
    case "running":
      return "RUN";
    case "idle":
      return "IDLE";
    default:
      return state.toUpperCase(); // MOVE, MINE, DROP, CHARGE
  }
}

// Приоритет индикации: ошибка → пауза → текущий статус программы.
const PAUSED_COLOR = "#ff8844";

function indicatorColor(drone: DroneState): string {
  if (drone.codeError) return ERROR_COLOR;
  if (drone.localPaused) return PAUSED_COLOR;
  return statusColor(drone.programState);
}

function indicatorLabel(drone: DroneState): string {
  if (drone.codeError) return "ERR";
  return statusLabel(drone.programState);
}

const ICON_BTN: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0 3px",
  lineHeight: 1,
  fontSize: "13px",
  width: "20px",
  height: "20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "2px",
  flexShrink: 0,
};

export function DroneList() {
  const drones = useGameStore((s) => s.drones);
  const selectedId = useGameStore((s) => s.selectedDroneId);
  const selectDrone = useGameStore((s) => s.selectDrone);
  const startDrone = useGameStore((s) => s.startDrone);
  const pauseDrone = useGameStore((s) => s.pauseDrone);
  const resetDrone = useGameStore((s) => s.resetDrone);

  return (
    <div style={{ padding: "8px 0" }}>
      <div
        style={{
          color: "#4488ff",
          fontFamily: "monospace",
          fontSize: "11px",
          padding: "4px 12px 8px",
          letterSpacing: "1px",
        }}
      >
        DRONES [{drones.length}]
      </div>
      {drones.map((d) => {
        const isSelected = d.id === selectedId;
        const hasError = !!d.codeError;
        const dotColor = indicatorColor(d);
        const statusText = indicatorLabel(d);
        const statusTextColor = hasError
          ? ERROR_COLOR
          : statusColor(d.programState);
        const pauseColor = d.localPaused ? PAUSED_COLOR : "#445566";
        return (
          <div
            key={d.id}
            data-testid={`drone-item-${d.id}`}
            onClick={() => selectDrone(d.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 12px",
              cursor: "pointer",
              background: isSelected ? "#0d2040" : "transparent",
              borderLeft: isSelected
                ? "2px solid #00d4ff"
                : "2px solid transparent",
              transition: "background 0.1s",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: dotColor,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span
              data-testid={`drone-name-${d.id}`}
              style={{
                color: "#c0cfe0",
                fontFamily: "monospace",
                fontSize: "13px",
                flex: 1,
              }}
            >
              Drone #{d.id}
            </span>
            {hasError && (
              <span
                title={d.codeError ?? undefined}
                style={{ color: ERROR_COLOR, fontSize: "12px" }}
              >
                ⚠
              </span>
            )}
            <span
              style={{
                color: statusTextColor,
                fontFamily: "monospace",
                fontSize: "10px",
                letterSpacing: "0.5px",
                position: "relative",
                top: "2px",
              }}
            >
              {statusText}
            </span>
            <button
              data-testid={`drone-play-pause-${d.id}`}
              style={{ ...ICON_BTN, color: pauseColor }}
              title={d.localPaused ? "Resume" : "Pause"}
              onClick={(e) => {
                e.stopPropagation();
                d.localPaused ? startDrone(d.id) : pauseDrone(d.id);
              }}
            >
              {d.localPaused ? "▶" : "⏸"}
            </button>
            <button
              data-testid={`drone-reset-${d.id}`}
              style={{ ...ICON_BTN, color: "#445566" }}
              title="Reset"
              onClick={(e) => {
                e.stopPropagation();
                resetDrone(d.id);
              }}
            >
              ↺
            </button>
          </div>
        );
      })}
      {drones.length === 0 && (
        <div
          style={{
            color: "#445566",
            fontFamily: "monospace",
            fontSize: "12px",
            padding: "8px 12px",
          }}
        >
          No drones
        </div>
      )}
    </div>
  );
}
