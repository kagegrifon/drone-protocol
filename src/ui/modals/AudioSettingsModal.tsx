import type { AudioManager } from "../../renderer/audio/AudioManager.js";
import { useAudioStore } from "../../shared/store/audioStore.js";
import { useGameStore } from "../../shared/store/gameStore.js";

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioManager: AudioManager | null;
  onBackToMissions?: () => void;
}

const OVERLAY: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 400,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const PANEL: React.CSSProperties = {
  width: "340px",
  background: "#0a1628",
  border: "1px solid #1a3a5a",
  borderRadius: "4px",
  padding: "20px 24px",
  fontFamily: "monospace",
};

const TITLE: React.CSSProperties = {
  fontSize: "13px",
  letterSpacing: "3px",
  color: "#00d4ff",
  marginBottom: "16px",
};

const SECTION: React.CSSProperties = {
  fontSize: "10px",
  letterSpacing: "2px",
  color: "#2a4a6a",
  marginBottom: "10px",
};

const ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "8px",
};

const LABEL: React.CSSProperties = {
  fontSize: "11px",
  color: "#4a8aaa",
  width: "20px",
  flexShrink: 0,
};

const SLIDER: React.CSSProperties = {
  flex: 1,
  accentColor: "#00d4ff",
  cursor: "pointer",
};

const VAL: React.CSSProperties = {
  fontSize: "10px",
  color: "#2a6a8a",
  width: "28px",
  textAlign: "right",
  flexShrink: 0,
};

const RADIO_ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  cursor: "pointer",
  fontSize: "11px",
  color: "#c0cfe0",
};

const HINT: React.CSSProperties = {
  fontSize: "10px",
  color: "#445566",
  marginTop: "4px",
  marginBottom: "8px",
};

const CLOSE_BTN: React.CSSProperties = {
  marginTop: "16px",
  width: "100%",
  background: "#0d2040",
  border: "1px solid #1a3a5a",
  color: "#4a8aaa",
  padding: "8px",
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: "11px",
  letterSpacing: "2px",
  borderRadius: "3px",
};

export function AudioSettingsModal({
  isOpen,
  onClose,
  audioManager,
  onBackToMissions,
}: AudioSettingsModalProps) {
  const { musicVol, sfxVol, setMusicVol, setSfxVol } = useAudioStore();
  const codeModeEnabled = useGameStore((s) => s.codeModeEnabled);
  const setCodeModeEnabled = useGameStore((s) => s.setCodeModeEnabled);
  const gameStatus = useGameStore((s) => s.gameStatus);
  const codeModeLocked =
    gameStatus === "running" || gameStatus === "paused";

  if (!isOpen) return null;

  const handleMusicVol = (v: number) => {
    setMusicVol(v);
    audioManager?.setMusicVolume(v / 100);
  };

  const handleSfxVol = (v: number) => {
    setSfxVol(v);
    audioManager?.setSfxVolume(v / 100);
  };

  return (
    <div style={OVERLAY} onClick={onClose}>
      <div style={PANEL} onClick={(e) => e.stopPropagation()}>
        <div style={TITLE}>⚙ НАСТРОЙКИ</div>
        <div style={SECTION}>АУДИО</div>
        <div style={ROW}>
          <span style={LABEL}>🎵</span>
          <input
            type="range"
            min={0}
            max={100}
            value={musicVol}
            style={SLIDER}
            onChange={(e) => handleMusicVol(+e.target.value)}
          />
          <span style={VAL}>{musicVol}%</span>
        </div>
        <div style={ROW}>
          <span style={LABEL}>🔊</span>
          <input
            type="range"
            min={0}
            max={100}
            value={sfxVol}
            style={SLIDER}
            onChange={(e) => handleSfxVol(+e.target.value)}
          />
          <span style={VAL}>{sfxVol}%</span>
        </div>
        <div style={{ ...SECTION, marginTop: "16px" }}>
          РЕЖИМ ПРОГРАММИРОВАНИЯ
        </div>
        <div style={ROW}>
          <label style={RADIO_ROW}>
            <input
              type="radio"
              name="code-mode"
              data-testid="code-mode-toggle"
              checked={!codeModeEnabled}
              disabled={codeModeLocked}
              onChange={() => setCodeModeEnabled(false)}
            />
            БЛОКИ
          </label>
          <label style={RADIO_ROW}>
            <input
              type="radio"
              name="code-mode"
              checked={codeModeEnabled}
              disabled={codeModeLocked}
              onChange={() => setCodeModeEnabled(true)}
            />
            КОД
          </label>
        </div>
        {codeModeLocked && (
          <div style={HINT}>режим фиксируется на время миссии</div>
        )}
        {onBackToMissions && (
          <button
            style={{
              ...CLOSE_BTN,
              marginTop: "12px",
              color: "#00d4ff",
              borderColor: "#1a4a6a",
            }}
            onClick={onBackToMissions}
          >
            ← ВЫБОР МИССИЙ
          </button>
        )}
        <button style={CLOSE_BTN} onClick={onClose}>
          ✕ ЗАКРЫТЬ
        </button>
      </div>
    </div>
  );
}
