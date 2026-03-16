"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatRelativeTime } from "../../lib/utils";

const MODEL_STATUS_UPDATE_INTERVAL_MS = 15_000;

function NextModelUpdateText({ updatedAt }: { updatedAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const nextAt = updatedAt + MODEL_STATUS_UPDATE_INTERVAL_MS;
  const remainingSec = Math.max(0, Math.ceil((nextAt - now) / 1000));

  if (remainingSec <= 10) {
    return (
      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
        次回更新まで: {remainingSec}s
      </span>
    );
  }

  const nextAtText = new Date(nextAt).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  });

  return (
    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
      次回更新目安: {nextAtText}
    </span>
  );
}

function PercentBar({ label, value }: { label: string; value: number }) {
  const color = value > 20 ? "var(--green)" : value > 5 ? "var(--yellow)" : "var(--red)";
  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{label}</span>
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color }}>{value}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, backgroundColor: "var(--border)", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${Math.min(100, Math.max(0, value))}%`,
          borderRadius: 2,
          backgroundColor: color,
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

export function ModelStatusCard({ agentId = "openclaw-main" }: { agentId?: string }) {
  const models = useQuery(api.queries.getModelStatusForAgent, { agent_id: agentId });

  return (
    <div style={{
      backgroundColor: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "0.75rem",
      padding: "1.25rem",
      minWidth: 0,
    }}>
      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
        Model Status
      </p>

      {!models || models.length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>No models reported</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {models.map((m) => (
            <div key={m._id}>
              <p style={{
                fontSize: "0.875rem", color: "var(--text)", fontFamily: "monospace",
                marginBottom: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {m.model}
              </p>
              <PercentBar label="5時間枠の残り" value={m.remaining_percent} />
              {m.remaining_day_percent !== undefined && (
                <PercentBar label="24時間枠の残り" value={m.remaining_day_percent} />
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  Updated {formatRelativeTime(m.updated_at)}
                </span>
                <NextModelUpdateText updatedAt={m.updated_at} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
