import { useEffect, useRef, useState, type ReactNode } from "react";

type Mode = "normal" | "collapsed" | "fullscreen";

const STORAGE_KEY = "droneloop.bottomPanelHeight";
const DEFAULT_HEIGHT = 360;
const MIN_HEIGHT = 200;
const COLLAPSED_HEIGHT = 36;

function loadHeight(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_HEIGHT;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= MIN_HEIGHT ? n : DEFAULT_HEIGHT;
  } catch {
    return DEFAULT_HEIGHT;
  }
}

const ICON_BTN: React.CSSProperties = {
  background: "rgba(10, 22, 40, 0.85)",
  border: "1px solid #1e3a5f",
  color: "#88aacc",
  fontFamily: "monospace",
  fontSize: "12px",
  width: "26px",
  height: "22px",
  cursor: "pointer",
  borderRadius: "3px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};

export function BottomPanel({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("normal");
  const [height, setHeight] = useState<number>(() => loadHeight());
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(height));
    } catch {
      // ignore
    }
  }, [height]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const st = dragStateRef.current;
      if (!st) return;
      const parent = containerRef.current?.parentElement;
      const parentH = parent?.clientHeight ?? window.innerHeight;
      const max = Math.max(MIN_HEIGHT, parentH - 60);
      const next = Math.max(MIN_HEIGHT, Math.min(max, st.startH + (st.startY - e.clientY)));
      setHeight(next);
    };
    const onUp = () => {
      dragStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const onHandleDown = (e: React.MouseEvent) => {
    if (mode !== "normal") return;
    e.stopPropagation();
    dragStateRef.current = { startY: e.clientY, startH: height };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  const showHandle = mode === "normal";

  const panelHeight = mode === "collapsed" ? COLLAPSED_HEIGHT : height;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        ...(mode === "fullscreen" ? { top: 0 } : { height: panelHeight }),
        display: "flex",
        flexDirection: "column",
        background: "#0a0e1a",
        borderTop: "1px solid #1e3a5f",
        zIndex: 10,
      }}
    >
      {showHandle && (
        <div
          onMouseDown={onHandleDown}
          title="Resize"
          style={{
            position: "absolute",
            top: -3,
            left: 0,
            right: 0,
            height: 6,
            cursor: "row-resize",
            zIndex: 15,
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          top: 4,
          right: 6,
          display: "flex",
          gap: 4,
          zIndex: 14,
        }}
      >
        {mode === "fullscreen" ? (
          <button style={ICON_BTN} title="Restore" onClick={() => setMode("normal")}>
            ▼
          </button>
        ) : (
          <>
            <button
              style={ICON_BTN}
              title={mode === "collapsed" ? "Expand" : "Collapse"}
              onClick={() => setMode(mode === "collapsed" ? "normal" : "collapsed")}
            >
              {mode === "collapsed" ? "▲" : "▽"}
            </button>
            <button style={ICON_BTN} title="Fullscreen" onClick={() => setMode("fullscreen")}>
              ⛶
            </button>
          </>
        )}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}
