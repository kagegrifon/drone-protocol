export function LoadingScreen() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "#050810",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
      }}
    >
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .loader {
          width: 40px; height: 40px;
          border: 2px solid #1e3a5f;
          border-top-color: #00d4ff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
      `}</style>
      <div className="loader" />
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "11px",
          letterSpacing: "3px",
          color: "#2a4a6a",
        }}
      >
        ИНИЦИАЛИЗАЦИЯ СИСТЕМ…
      </div>
    </div>
  );
}
