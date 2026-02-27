"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { StatusBadge } from "./StatusBadge";
import { formatRelativeTime, DOWN_THRESHOLD_MS } from "../../lib/utils";

type EffectiveStatus = "running" | "idle" | "stopped" | "down";

export function getEffectiveStatus(
  data: { status: string; last_seen: number; current_task?: string } | null | undefined
): EffectiveStatus {
  if (!data) return "down";

  // stale heartbeat は最優先で down（"オフラインなのに稼働中" を防ぐ）
  if (Date.now() - data.last_seen > DOWN_THRESHOLD_MS) return "down";

  // stopped は明示的に優先
  if (data.status === "stopped") return "stopped";

  // current_task がある間は running 扱い
  if (data.current_task && data.current_task.trim().length > 0) return "running";

  // それ以外は idle に正規化
  if (data.status === "running") return "idle";
  if (data.status === "idle") return "idle";

  return "idle";
}

export function AgentStatusCard({ agentId = "openclaw-main" }: { agentId?: string }) {
  const data = useQuery(api.queries.getAgentStatus, { agent_id: agentId });
  const effectiveStatus = getEffectiveStatus(data);

  return (
    <div
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "0.75rem",
        padding: "1.25rem",
        minWidth: 0,
      }}
    >
      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
        Agent Status
      </p>
      <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.75rem", fontFamily: "monospace" }}>
        {agentId}
      </p>

      <div style={{ marginBottom: "0.875rem" }}>
        <StatusBadge status={effectiveStatus} />
      </div>

      <Row label="Task"      value={data?.current_task  ?? "—"} />
      <Row label="Model"     value={data?.current_model ?? "—"} mono />
      <Row label="Last seen" value={data?.last_seen ? formatRelativeTime(data.last_seen) : "—"} muted />

      {data === undefined && (
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>Loading...</p>
      )}
    </div>
  );
}

function Row({ label, value, mono = false, muted = false }: {
  label: string; value: string; mono?: boolean; muted?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.375rem" }}>
      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: "0.8125rem",
        color: muted ? "var(--text-muted)" : "var(--text)",
        fontFamily: mono ? "monospace" : "inherit",
        textAlign: "right",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "16rem",
      }}>
        {value}
      </span>
    </div>
  );
}
