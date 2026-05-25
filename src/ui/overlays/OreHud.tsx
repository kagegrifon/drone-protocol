import { useGameStore } from "../../shared/store/gameStore.js";

export function OreHud() {
  const oreMined = useGameStore((s) => s.stats.oreMined);

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 10,
        background: "rgba(10, 14, 26, 0.78)",
        border: "1px solid #1e3a5f",
        borderRadius: 4,
        padding: "6px 10px",
        fontFamily: "monospace",
        fontSize: 13,
        color: "#00ff88",
        letterSpacing: "0.5px",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <span style={{ color: "#88aacc", marginRight: 6 }}>⛏</span>
      <span>{oreMined}</span>
    </div>
  );
}
