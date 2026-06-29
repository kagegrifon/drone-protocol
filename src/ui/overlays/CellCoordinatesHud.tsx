import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../../shared/store/gameStore.js";

const HOVER_DELAY_MS = 1000;
const COPIED_FEEDBACK_MS = 1200;

const CONTAINER: React.CSSProperties = {
  position: "absolute",
  bottom: 12,
  right: 12,
  zIndex: 10,
  fontFamily: "monospace",
  fontSize: 13,
  userSelect: "none",
};

const HUD_BOX: React.CSSProperties = {
  background: "rgba(10, 14, 26, 0.78)",
  border: "1px solid #1e3a5f",
  borderRadius: 4,
  padding: "6px 10px",
  color: "#00d4ff",
  letterSpacing: "0.5px",
};

const POPUP: React.CSSProperties = {
  position: "absolute",
  bottom: "calc(100% + 6px)",
  right: 0,
  minWidth: 140,
  background: "#0a0e1a",
  border: "1px solid #1e3a5f",
  borderRadius: 4,
  padding: "8px 10px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#c0cfe0",
};

const COPY_BTN: React.CSSProperties = {
  background: "#0d2040",
  border: "1px solid #1a3a5a",
  color: "#4a8aaa",
  borderRadius: 3,
  padding: "2px 6px",
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: 13,
};

export function CellCoordinatesHud() {
  const hoveredCell = useGameStore((s) => s.hoveredCell);
  const [showPopup, setShowPopup] = useState(false);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Очищаем таймер feedback-копирования при размонтировании.
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // На каждую смену клетки перезапускаем таймер задержки и прячем попап.
  useEffect(() => {
    setShowPopup(false);
    setCopied(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (hoveredCell === null) return;
    timerRef.current = setTimeout(() => setShowPopup(true), HOVER_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [hoveredCell]);

  if (hoveredCell === null) return null;

  const { x, y } = hoveredCell;
  const copyText = `{ x: ${x}, y: ${y} }`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <div style={{ ...CONTAINER, pointerEvents: "auto" }} data-testid="cell-coords-hud">
      {showPopup && (
        <div style={POPUP} data-testid="cell-coords-popup">
          <span>{copyText}</span>
          <button
            style={COPY_BTN}
            onClick={handleCopy}
            data-testid="cell-coords-copy"
            title="Скопировать координаты"
          >
            {copied ? "✓" : "⧉"}
          </button>
        </div>
      )}
      <div style={HUD_BOX}>
        <span style={{ color: "#88aacc", marginRight: 6 }}>⌖</span>
        <span>
          x: {x}  y: {y}
        </span>
      </div>
    </div>
  );
}
