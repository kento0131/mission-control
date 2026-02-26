"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const levelColor: Record<string, string> = {
  info: "var(--text)",
  warn: "var(--yellow)",
  error: "var(--red)",
  debug: "var(--text-muted)",
};

export function LogTail({ jobId }: { jobId: string }) {
  const logs = useQuery(api.queries.getJobLogs, { job_id: jobId });

  if (!logs) {
    return <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading logs...</p>;
  }

  if (logs.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No logs</p>;
  }

  return (
    <div
      style={{
        backgroundColor: "#07070d",
        border: "1px solid var(--border)",
        borderRadius: "0.5rem",
        padding: "1rem",
        fontFamily: "monospace",
        fontSize: "0.8125rem",
        lineHeight: 1.6,
        maxHeight: "32rem",
        overflowY: "auto",
      }}
    >
      {logs.map((log) => (
        <div key={log._id} style={{ display: "flex", gap: "0.75rem" }}>
          <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
            {new Date(log.ts).toISOString().slice(11, 23)}
          </span>
          <span
            style={{
              color: "var(--text-muted)",
              flexShrink: 0,
              textTransform: "uppercase",
              fontSize: "0.6875rem",
              fontWeight: 700,
            }}
          >
            {log.level}
          </span>
          <span style={{ color: levelColor[log.level] ?? "var(--text)" }}>
            {log.message}
          </span>
        </div>
      ))}
    </div>
  );
}
