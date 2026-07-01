import { useGameStore } from "../../shared/store/gameStore.js";

interface SimControlsProps {
  onPlay: () => void;
  onPause: () => void;
  onToggleStepMode: () => void;
  onOpenSettings: () => void;
}

const BTN: React.CSSProperties = {
  background: "#0a1628",
  border: "1px solid #1e3a5f",
  color: "#00d4ff",
  padding: "6px 14px",
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: "13px",
  borderRadius: "3px",
  transition: "background 0.15s",
};

const BTN_ACTIVE: React.CSSProperties = {
  ...BTN,
  background: "#0d2040",
  border: "1px solid #00d4ff",
};

const BTN_DISABLED: React.CSSProperties = {
  ...BTN,
  opacity: 0.4,
  cursor: "default",
};

const BTN_STEP: React.CSSProperties = {
  ...BTN,
  color: "#ff7a1a",
  border: "1px solid #5a3a1f",
};

const BTN_STEP_ACTIVE: React.CSSProperties = {
  ...BTN,
  background: "#ff7a1a",
  color: "#1a0d00",
  border: "1px solid #ff7a1a",
  fontWeight: "bold",
};

export function SimControls({
  onPlay,
  onPause,
  onToggleStepMode,
  onOpenSettings,
}: SimControlsProps) {
  const isRunning = useGameStore((s) => s.isRunning);
  const gameStatus = useGameStore((s) => s.gameStatus);
  const isStepMode = useGameStore((s) => s.isStepMode);

  const isFinished = gameStatus === "won" || gameStatus === "failed";

  function playButtonStyle(): React.CSSProperties {
    if (isFinished) return BTN_DISABLED;
    if (isRunning) return BTN_ACTIVE;
    return BTN;
  }

  const stepButtonStyle = isStepMode ? BTN_STEP_ACTIVE : BTN_STEP;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "8px",
        padding: "10px 12px",
        borderBottom: "1px solid #1e3a5f",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          style={playButtonStyle()}
          disabled={isFinished}
          onClick={() => (isRunning ? onPause() : onPlay())}
        >
          {isRunning ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          style={stepButtonStyle}
          onClick={onToggleStepMode}
          data-testid="step-mode-toggle"
          title="Пошаговый просмотр работы дрона"
        >
          ⏯ Step Mode
        </button>
      </div>
      <button
        style={{
          ...BTN,
          fontSize: "13px",
          padding: "4px 8px",
          color: "#4a8aaa",
        }}
        onClick={onOpenSettings}
        title="Настройки"
        data-testid="open-settings"
      >
        ⚙
      </button>
    </div>
  );
}
