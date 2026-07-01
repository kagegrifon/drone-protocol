import { memo } from "react";
import { useGameStore } from "../../../shared/store/gameStore.js";
import { BTN } from "./styles.js";

export const DroneControls = memo(function DroneControls({
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
