"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AgentDesk } from "./AgentDesk";
import { getEffectiveStatus } from "../components/AgentStatusCard";
import { formatRelativeTime, DOWN_THRESHOLD_MS } from "../../lib/utils";

// 固定表示エージェント（要望反映）
const SEED_AGENTS = ["openclaw-main", "claude-code", "coding-agent", "designer", "debugger"];

type AgentRow = {
  _id: string;
  agent_id: string;
  status: string;
  last_seen: number;
  current_task?: string;
  current_model?: string;
};

// ── 詳細パネル ────────────────────────────────────────
function DetailPanel({
  agentId,
  agent,
  onClose,
}: {
  agentId: string;
  agent: AgentRow | null | undefined;
  onClose: () => void;
}) {
  const [rawOpen, setRawOpen] = useState(false);
  const models = useQuery(api.queries.getModelStatusForAgent, { agent_id: agentId });
  const effectiveStatus = getEffectiveStatus(agent);

  const statusColor: Record<string, string> = {
    running: "#22c55e",
    idle:    "#eab308",
    stopped: "#6b7280",
    down:    "#ef4444",
  };

  return (
    <>
      {/* オーバーレイ */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 40,
        }}
      />
      {/* パネル本体 */}
      <div style={{
        position: "fixed",
        top: 0, right: 0, bottom: 0,
        width: "min(420px, 100vw)",
        backgroundColor: "var(--bg-card)",
        borderLeft: "1px solid var(--border)",
        zIndex: 50,
        overflowY: "auto",
        animation: "panel-slide-in 0.25s ease",
        padding: "1.5rem",
      }}>
        {/* ヘッダー */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Agent</p>
            <p style={{ fontFamily: "monospace", fontSize: "1rem", fontWeight: 700 }}>{agentId}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "var(--text-muted)",
              fontSize: "1.25rem", cursor: "pointer", lineHeight: 1, padding: "0.25rem",
            }}
          >
            ×
          </button>
        </div>

        {/* ステータス */}
        <Section title="Status">
          {agent ? (
            <>
              <Row label="Status">
                <span style={{ fontWeight: 700, color: statusColor[effectiveStatus] ?? "var(--text)" }}>
                  {effectiveStatus.toUpperCase()}
                </span>
              </Row>
              <Row label="Last seen">
                {formatRelativeTime(agent.last_seen)}
              </Row>
              {agent.current_task && (
                <Row label="Current task">{agent.current_task}</Row>
              )}
              {agent.current_model && (
                <Row label="Current model">
                  <span style={{ fontFamily: "monospace" }}>{agent.current_model}</span>
                </Row>
              )}
            </>
          ) : (
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>No data received</p>
          )}
        </Section>

        {/* Model Status */}
        {models && models.length > 0 && (
          <Section title="Model Status">
            {models.map((m) => (
              <div key={m._id} style={{ marginBottom: "1rem" }}>
                <p style={{ fontFamily: "monospace", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                  {m.model}
                </p>
                <MiniBar label="Usage（セッション残量）" value={m.remaining_percent} />
                {m.remaining_day_percent !== undefined && (
                  <MiniBar label="Day（本日残量）" value={m.remaining_day_percent} />
                )}
                {m.raw && (
                  <details
                    open={rawOpen}
                    onToggle={(e) => setRawOpen((e.target as HTMLDetailsElement).open)}
                  >
                    <summary style={{ fontSize: "0.7rem", color: "var(--text-muted)", cursor: "pointer", marginTop: "0.5rem" }}>
                      raw output
                    </summary>
                    <pre style={{
                      fontSize: "0.7rem",
                      color: "var(--text-muted)",
                      marginTop: "0.5rem",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      backgroundColor: "#07070d",
                      padding: "0.75rem",
                      borderRadius: "0.375rem",
                    }}>
                      {m.raw}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </Section>
        )}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p style={{
        fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem",
        borderBottom: "1px solid var(--border)", paddingBottom: "0.375rem",
      }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: "0.875rem", color: "var(--text)" }}>{children}</span>
    </div>
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  const color = value > 20 ? "#22c55e" : value > 5 ? "#eab308" : "#ef4444";
  return (
    <div style={{ marginBottom: "0.375rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.15rem" }}>
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{label}</span>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color }}>{value}%</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, backgroundColor: "var(--border)" }}>
        <div style={{
          height: "100%",
          width: `${Math.min(100, Math.max(0, value))}%`,
          backgroundColor: color,
          borderRadius: 2,
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

// ── Office Page ───────────────────────────────────────
export default function OfficePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const allAgents = useQuery(api.queries.getAllAgents);

  // seed + DB のユニーク一覧を構築
  // 表示対象は固定seed + sub-agent* のみ（test系や旧agentは非表示）
  const dbMap = new Map((allAgents ?? []).map((a) => [a.agent_id, a]));
  const dbIds = (allAgents ?? [])
    .map((a) => a.agent_id)
    .filter((id) => id.startsWith("sub-agent") && !SEED_AGENTS.includes(id));
  const allIds = [...SEED_AGENTS, ...dbIds];

  const selectedAgent = selectedId ? dbMap.get(selectedId) ?? null : null;

  // アクティブエージェント数
  const activeCount = (allAgents ?? []).filter((a) => {
    if (a.status === "stopped") return false;
    return Date.now() - a.last_seen <= DOWN_THRESHOLD_MS;
  }).length;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Office</h1>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          {activeCount} / {allIds.length} active
        </span>
      </div>

      {/* フロア説明 */}
      <div style={{
        display: "flex",
        gap: "1.25rem",
        marginBottom: "1.5rem",
        flexWrap: "wrap",
      }}>
        {(["running", "idle", "stopped", "down"] as const).map((s) => {
          const c = { running: "#22c55e", idle: "#eab308", stopped: "#6b7280", down: "#ef4444" }[s];
          const l = { running: "Running", idle: "Idle", stopped: "Stopped", down: "Down" }[s];
          return (
            <span key={s} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.75rem", color: "var(--text-muted)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: c, flexShrink: 0 }} />
              {l}
            </span>
          );
        })}
      </div>

      {/* デスクグリッド */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: "1.25rem",
      }}>
        {allIds.map((id) => (
          <AgentDesk
            key={id}
            agentId={id}
            agent={dbMap.get(id) ?? null}
            onClick={() => setSelectedId(id)}
          />
        ))}
      </div>

      {/* 詳細パネル */}
      {selectedId && (
        <DetailPanel
          agentId={selectedId}
          agent={selectedAgent}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
