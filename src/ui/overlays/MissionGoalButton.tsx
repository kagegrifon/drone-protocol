import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../../shared/store/gameStore.js";
import type { MissionDef } from "../../game/missions/types.js";

interface Props {
  mission: MissionDef;
}

function progressText(
  mission: MissionDef,
  oreMined: number,
  orePerMin: number,
  efficiency: number,
): string {
  const { win } = mission.config;
  switch (win.type) {
    case "ore_mined":
      return `${oreMined} / ${win.target}`;
    case "ore_per_min":
      return `${orePerMin.toFixed(1)} / ${win.target} ore/min`;
    case "efficiency":
      return `${efficiency}% / ${win.target}%`;
  }
}

export function MissionGoalButton({ mission }: Props) {
  const [open, setOpen] = useState(false);
  const stats = useGameStore((s) => s.stats);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        title="Цель миссии"
        style={{
          background: open ? "#0d2040" : "rgba(10, 22, 40, 0.85)",
          border: `1px solid ${open ? "#00d4ff" : "#1e3a5f"}`,
          color: "#ffd700",
          fontSize: 16,
          width: 32,
          height: 32,
          cursor: "pointer",
          borderRadius: 4,
          lineHeight: 1,
        }}
      >
        🎯
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 38,
            right: 0,
            minWidth: 240,
            background: "#0a0e1a",
            border: "1px solid #1e3a5f",
            borderRadius: 4,
            padding: "10px 12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              color: "#2a4a6a",
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: 2,
              marginBottom: 6,
            }}
          >
            ЦЕЛЬ
          </div>
          <div
            style={{
              color: "#c0cfe0",
              fontFamily: "monospace",
              fontSize: 12,
              marginBottom: 6,
              lineHeight: 1.4,
            }}
          >
            {mission.goalText}
          </div>
          <div
            style={{
              color: "#00ff88",
              fontFamily: "monospace",
              fontSize: 14,
              fontWeight: "bold",
            }}
          >
            {progressText(mission, stats.oreMined, stats.orePerMin, stats.efficiency)}
          </div>
        </div>
      )}
    </div>
  );
}
