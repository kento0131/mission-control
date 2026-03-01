"use client";

import { useEffect, useState } from "react";

type SubagentItem = {
  key: string;
  label: string;
  kind: string;
  model: string;
  agentId: string;
  updatedAt: number | null;
  ageMs: number;
  status: "running" | "idle" | "stale";
};

type SubagentResponse = {
  ts: number;
  count: number;
  items: SubagentItem[];
  error?: string;
};

function fmtAge(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

const STATUS_COLOR: Record<SubagentItem["status"], string> = {
  running: "#22c55e",
  idle: "#eab308",
  stale: "#6b7280",
};

export function SubagentsPanel() {
  const [data, setData] = useState<SubagentResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const fetchData = async () => {
      try {
        const res = await fetch("/api/subagents", { cache: "no-store" });
        const json = (await res.json()) as SubagentResponse;
        if (!alive) return;
        setData(json);
      } catch {
        if (!alive) return;
        setData({ ts: Date.now(), count: 0, items: [], error: "fetch failed" });
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchData();
    const timer = setInterval(fetchData, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <section style={{ marginTop: "2rem" }}>
      <h2
        style={{
          fontSize: "0.75rem",
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: "0.75rem",
        }}
      >
        Subagents
      </h2>

      <div
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <p style={{ padding: "1rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>Loading...</p>
        ) : data?.items?.length ? (
          <div>
            {data.items.map((it) => (
              <div
                key={it.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px,1fr) 90px 90px 120px 90px",
                  gap: "0.75rem",
                  alignItems: "center",
                  padding: "0.625rem 1rem",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {it.label}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{it.key}</div>
                </div>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{it.kind}</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{it.model}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{fmtAge(it.ageMs)}</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: STATUS_COLOR[it.status] }}>{it.status.toUpperCase()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ padding: "1rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
            {data?.error ? `No subagents (${data.error})` : "No active subagents"}
          </p>
        )}
      </div>
    </section>
  );
}
