import { useGameStore } from "../../shared/store/gameStore.js";

interface SimControlsProps {
  onPlay: () => void;
  onPause: () => void;
  onOpenSettings: () => void;
  /** Task 3 will implement the full UI; this prop is wired here for context. */
  onToggleStepMode?: () => void;
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

export function SimControls({
  onPlay,
  onPause,
  onOpenSettings,
}: SimControlsProps) {
  const isRunning = useGameStore((s) => s.isRunning);
  const gameStatus = useGameStore((s) => s.gameStatus);

  const isFinished = gameStatus === "won" || gameStatus === "failed";

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
      <button
        style={isFinished ? BTN_DISABLED : isRunning ? BTN_ACTIVE : BTN}
        disabled={isFinished}
        onClick={() => (isRunning ? onPause() : onPlay())}
      >
        {isRunning ? "⏸ Pause" : "▶ Play"}
      </button>
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
