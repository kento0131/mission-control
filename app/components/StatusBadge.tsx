type Status =
  | "running"
  | "idle"
  | "stopped"
  | "down"
  | "pending"
  | "success"
  | "failed";

const colorMap: Record<Status, string> = {
  running: "var(--green)",
  idle: "var(--yellow)",
  stopped: "#6b7280",   // gray — 正常終了
  down: "var(--red)",   // 通信断
  pending: "var(--blue)",
  success: "var(--green)",
  failed: "var(--red)",
};

export function StatusBadge({ status }: { status: Status }) {
  const color = colorMap[status] ?? "var(--text-muted)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.375rem",
        fontSize: "0.75rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  );
}
