export function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "8px",
      }}
    >
      <span
        style={{
          color: "#445566",
          fontFamily: "monospace",
          fontSize: "11px",
          width: "72px",
          flexShrink: 0,
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
