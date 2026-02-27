"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getEffectiveStatus } from "../components/AgentStatusCard";
import { JobsTable } from "../components/JobsTable";
import { formatRelativeTime, DOWN_THRESHOLD_MS } from "../../lib/utils";
import { ja } from "../../lib/i18n/ja";

// ── 定数 ──────────────────────────────────────────────
const SEED_AGENTS = ["openclaw-main", "discord-bot", "calendar-worker"];

/** 3状態ランプ: DOWN 判定と同じ閾値で揃える */
const LAMP_OFFLINE_MS = DOWN_THRESHOLD_MS;

const AVATAR_PALETTE = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#8b5cf6", "#14b8a6", "#f97316",
];

function getAvatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function getAgentIcon(id: string): string {
  if (id.includes("openclaw") || id.includes("claw")) return "⚡";
  if (id.includes("discord"))  return "💬";
  if (id.includes("calendar")) return "📅";
  if (id.includes("monitor"))  return "👁";
  if (id.includes("worker"))   return "⚙";
  return "🤖";
}

// Design spec: STOPPED=red, DOWN=gray
const STATUS_COLOR = {
  running: "#22c55e",
  idle:    "#eab308",
  stopped: "#ef4444",
  down:    "#6b7280",
} as const;

const JOB_STATUS_COLOR: Record<string, string> = {
  running: "#22c55e",
  success: "#4ade80",
  pending: "#eab308",
  failed:  "#ef4444",
};

// ── 型 ────────────────────────────────────────────────
type AgentRow = {
  _id: string;
  agent_id: string;
  status: string;
  last_seen: number;
  current_task?: string;
  current_model?: string;
};

type ModelRow = {
  _id: string;
  agent_id: string;
  model: string;
  remaining_percent: number;
  remaining_day_percent?: number;
  raw?: string;
  updated_at: number;
};

type JobRow = {
  _id: string;
  job_id: string;
  agent_id?: string;
  title: string;
  status: string;
  started_at: number;
  finished_at?: number;
};

type JobEventRow = {
  _id: string;
  agent_id: string;
  type: "job_started" | "job_completed";
  task: string;
  created_at: number;
};

type FeedItem =
  | { kind: "job";   ts: number; id: string; agent_id?: string; label: string; badge: string; color: string }
  | { kind: "event"; ts: number; id: string; agent_id: string;  label: string; badge: string; color: string };

// ── サブコンポーネント ─────────────────────────────────

function Avatar({ id, size = 40 }: { id: string; size?: number }) {
  const color = getAvatarColor(id);
  const icon  = getAgentIcon(id);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      backgroundColor: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.45,
      flexShrink: 0, userSelect: "none",
    }}>
      {icon}
    </div>
  );
}

const STATUS_LABEL: Record<keyof typeof STATUS_COLOR, string> = {
  running: ja.status.running,
  idle:    ja.status.idle,
  stopped: ja.status.stopped,
  down:    ja.status.down,
};

function StatusBadge({ status }: { status: keyof typeof STATUS_COLOR }) {
  const color     = STATUS_COLOR[status];
  const isRunning = status === "running";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", backgroundColor: color,
        flexShrink: 0,
        boxShadow: isRunning ? `0 0 6px 2px ${color}80` : undefined,
        animation: isRunning ? "screen-running 2s ease-in-out infinite" : undefined,
      }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

// ── StatusLamp ─────────────────────────────────────────
type LampState = "offline" | "active" | "idle";

function getLampState(agent: AgentRow | undefined): LampState {
  if (!agent || Date.now() - agent.last_seen > LAMP_OFFLINE_MS) return "offline";
  if (agent.current_task) return "active";
  return "idle";
}

const LAMP: Record<LampState, { color: string; shadow: string; pulse: boolean; label: string }> = {
  offline: { color: "#ef4444", shadow: "0 0 6px 3px #ef444455", pulse: false, label: ja.lamp.offline },
  active:  { color: "#3b82f6", shadow: "0 0 8px 4px #3b82f655", pulse: true,  label: ja.lamp.active  },
  idle:    { color: "#22c55e", shadow: "0 0 6px 3px #22c55e55", pulse: false, label: ja.lamp.idle    },
};

function StatusLamp({ agent }: { agent: AgentRow | undefined }) {
  const state = getLampState(agent);
  const { color, shadow, pulse, label } = LAMP[state];
  return (
    <div
      title={label}
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        backgroundColor: color,
        boxShadow: shadow,
        flexShrink: 0,
        alignSelf: "flex-start",
        marginTop: 3,
        animation: pulse ? "screen-running 2s ease-in-out infinite" : undefined,
      }}
    />
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  const color = value > 20 ? "#22c55e" : value > 5 ? "#eab308" : "#ef4444";
  return (
    <div style={{ marginBottom: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{label}</span>
        <span style={{ fontSize: "0.7rem", fontWeight: 600, color }}>{value}%</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, backgroundColor: "var(--border)" }}>
        <div style={{
          height: "100%", borderRadius: 2, backgroundColor: color,
          width: `${Math.min(100, Math.max(0, value))}%`,
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

function FullBar({ label, value }: { label: string; value: number }) {
  const color = value > 20 ? "#22c55e" : value > 5 ? "#eab308" : "#ef4444";
  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{label}</span>
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color }}>{value}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, backgroundColor: "var(--border)", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3, backgroundColor: color,
          width: `${Math.min(100, Math.max(0, value))}%`,
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

// ── AgentCard ─────────────────────────────────────────
function AgentCard({
  agentId,
  agent,
  models,
  selected,
  onClick,
}: {
  agentId: string;
  agent: AgentRow | undefined;
  models: ModelRow[];
  selected: boolean;
  onClick: () => void;
}) {
  const status  = getEffectiveStatus(agent);
  const isDown  = status === "down";
  const topModel = models[0];

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: selected ? "var(--bg-card-hover)" : "var(--bg-card)",
        border: `1px solid ${selected ? "rgba(255,255,255,0.18)" : "var(--border)"}`,
        borderRadius: 12,
        padding: "1rem",
        cursor: "pointer",
        transition: "border-color 0.15s, background-color 0.15s, opacity 0.3s, filter 0.3s",
        opacity: isDown ? 0.38 : status === "stopped" ? 0.6 : 1,
        filter: isDown ? "grayscale(0.7)" : "none",
        outline: selected ? "2px solid rgba(255,255,255,0.12)" : "none",
      }}
      onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-card-hover)"; }}
      onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-card)"; }}
    >
      {/* 上段: avatar + status + last_seen + lamp */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem", marginBottom: "0.625rem" }}>
        <Avatar id={agentId} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <StatusBadge status={status} />
          <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 3, lineHeight: 1 }}>
            {agent?.last_seen ? formatRelativeTime(agent.last_seen) : ja.agent.noData}
          </p>
        </div>
        <StatusLamp agent={agent} />
      </div>

      {/* agent_id */}
      <p style={{
        fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 700,
        color: "var(--text)", marginBottom: "0.5rem",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {agentId}
      </p>

      {/* task */}
      <div style={{ display: "flex", gap: 4, alignItems: "baseline", marginBottom: 2 }}>
        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", flexShrink: 0 }}>▶</span>
        <span style={{
          fontSize: "0.75rem", color: "var(--text)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {agent?.current_task || "—"}
        </span>
      </div>

      {/* model */}
      <div style={{ display: "flex", gap: 4, alignItems: "baseline", marginBottom: "0.625rem" }}>
        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", flexShrink: 0 }}>◈</span>
        <span style={{
          fontSize: "0.7rem", fontFamily: "monospace", color: "var(--text-muted)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {agent?.current_model || "—"}
        </span>
      </div>

      {/* resource bars */}
      {topModel ? (
        <>
          <MiniBar label="Usage" value={topModel.remaining_percent} />
          {topModel.remaining_day_percent !== undefined && (
            <MiniBar label="Day" value={topModel.remaining_day_percent} />
          )}
        </>
      ) : (
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>—</span>
      )}
    </div>
  );
}

// ── ActivityFeed ───────────────────────────────────────
const EVENT_COLOR: Record<string, string> = {
  job_started:   "#3b82f6",
  job_completed: "#22c55e",
};
const EVENT_BADGE: Record<string, string> = {
  job_started:   "STARTED",
  job_completed: "DONE",
};

function buildFeed(jobs: JobRow[], events: JobEventRow[]): FeedItem[] {
  const jobItems: FeedItem[] = jobs.map((j) => ({
    kind: "job",
    ts: j.started_at,
    id: j._id,
    agent_id: j.agent_id,
    label: j.title,
    badge: j.status.toUpperCase(),
    color: JOB_STATUS_COLOR[j.status] ?? "#6b7280",
  }));
  const eventItems: FeedItem[] = events.map((e) => ({
    kind: "event",
    ts: e.created_at,
    id: e._id,
    agent_id: e.agent_id,
    label: e.task,
    badge: EVENT_BADGE[e.type] ?? e.type.toUpperCase(),
    color: EVENT_COLOR[e.type] ?? "#6b7280",
  }));
  return [...jobItems, ...eventItems]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 10);
}

function ActivityFeed({ jobs, events }: { jobs: JobRow[]; events: JobEventRow[] }) {
  const feed = buildFeed(jobs, events);

  if (feed.length === 0) {
    return (
      <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", padding: "1rem" }}>
        {ja.feed.empty}
      </p>
    );
  }

  return (
    <div>
      {feed.map((item) => (
        <div key={item.id} style={{
          display: "flex", gap: "1rem", alignItems: "center",
          padding: "0.5rem 1rem",
          borderBottom: "1px solid var(--border)",
        }}>
          {/* 時刻 */}
          <span style={{
            fontSize: "0.7rem", color: "var(--text-muted)",
            width: 52, flexShrink: 0, textAlign: "right",
          }}>
            {formatRelativeTime(item.ts)}
          </span>

          {/* エージェント */}
          <span style={{
            fontSize: "0.72rem", fontFamily: "monospace", color: "var(--text-muted)",
            width: 130, flexShrink: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {item.agent_id || "—"}
          </span>

          {/* ラベル */}
          <span style={{
            fontSize: "0.8rem", color: "var(--text)", flex: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {item.label}
          </span>

          {/* バッジ */}
          <span style={{
            fontSize: "0.65rem", fontWeight: 700,
            color: item.color, letterSpacing: "0.04em", flexShrink: 0,
          }}>
            {item.badge}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── DetailPanel ───────────────────────────────────────
function DetailPanel({
  agentId,
  agent,
  models,
  onClose,
}: {
  agentId: string;
  agent: AgentRow | undefined;
  models: ModelRow[];
  onClose: () => void;
}) {
  const status = getEffectiveStatus(agent);

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 40 }}
      />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(440px, 100vw)",
        backgroundColor: "var(--bg-card)",
        borderLeft: "1px solid var(--border)",
        zIndex: 50, overflowY: "auto",
        animation: "panel-slide-in 0.22s ease",
        display: "flex", flexDirection: "column",
      }}>
        {/* ヘッダー */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.875rem",
          padding: "1.25rem 1.25rem 1rem",
          borderBottom: "1px solid var(--border)",
        }}>
          <Avatar id={agentId} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: "monospace", fontSize: "0.9375rem", fontWeight: 700, marginBottom: 4 }}>{agentId}</p>
            <StatusBadge status={status} />
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "var(--text-muted)",
              fontSize: "1.25rem", cursor: "pointer", lineHeight: 1, padding: "0.25rem", flexShrink: 0,
            }}
          >×</button>
        </div>

        <div style={{ padding: "1.25rem", flex: 1 }}>

          {/* STATUS */}
          <SectionHeader>{ja.status.running}</SectionHeader>
          {agent ? (
            <div style={{ marginBottom: "1.25rem" }}>
              <DetailRow label={ja.agent.lastSeen}>{formatRelativeTime(agent.last_seen)}</DetailRow>
              <DetailRow label={ja.agent.task}>{agent.current_task || ja.common.noData}</DetailRow>
              <DetailRow label={ja.agent.model}>
                <span style={{ fontFamily: "monospace" }}>{agent.current_model || ja.common.noData}</span>
              </DetailRow>
            </div>
          ) : (
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
              {ja.agent.noData}
            </p>
          )}

          {/* MODEL STATUS */}
          <SectionHeader>{ja.agent.model}</SectionHeader>
          {models.length === 0 ? (
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>—</p>
          ) : (
            <div style={{ marginBottom: "1.25rem" }}>
              {models.map((m) => (
                <div key={m._id} style={{ marginBottom: "1rem" }}>
                  <p style={{ fontFamily: "monospace", fontSize: "0.875rem", marginBottom: "0.5rem" }}>{m.model}</p>
                  <FullBar label="Usage" value={m.remaining_percent} />
                  {m.remaining_day_percent !== undefined && (
                    <FullBar label="Day" value={m.remaining_day_percent} />
                  )}
                  <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4 }}>
                    Updated {formatRelativeTime(m.updated_at)}
                  </p>
                  {m.raw && (
                    <details style={{ marginTop: "0.5rem" }}>
                      <summary style={{ fontSize: "0.7rem", color: "var(--text-muted)", cursor: "pointer" }}>
                        raw output
                      </summary>
                      <pre style={{
                        fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.5rem",
                        whiteSpace: "pre-wrap", wordBreak: "break-all",
                        backgroundColor: "#07070d", padding: "0.75rem", borderRadius: "0.375rem",
                      }}>{m.raw}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* RECENT JOBS */}
          <SectionHeader>{ja.job.historyTitle}</SectionHeader>
          <div style={{
            marginLeft: "-1.25rem", marginRight: "-1.25rem",
            borderTop: "1px solid var(--border)",
          }}>
            <JobsTable limit={5} />
          </div>
        </div>
      </div>
    </>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)",
      textTransform: "uppercase", letterSpacing: "0.08em",
      borderBottom: "1px solid var(--border)", paddingBottom: "0.375rem", marginBottom: "0.75rem",
    }}>
      {children}
    </p>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginBottom: "0.5rem",
    }}>
      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: "0.875rem", color: "var(--text)" }}>{children}</span>
    </div>
  );
}

// ── JobHistory ────────────────────────────────────────
type JobHistoryRow = {
  _id: string;
  job_id: string;
  agent_id?: string;
  task: string;
  status: "started" | "completed" | "failed";
  started_at: number;
  completed_at?: number;
  duration_ms?: number;
};

const JOB_HISTORY_STATUS_COLOR: Record<string, string> = {
  started:   "#3b82f6",
  completed: "#22c55e",
  failed:    "#ef4444",
};

const JOB_HISTORY_STATUS_LABEL: Record<string, string> = {
  started:   ja.job.started,
  completed: ja.job.completed,
  failed:    ja.job.failed,
};

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return ja.common.noData;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function JobHistorySection() {
  const history = useQuery(api.queries.getRecentJobHistory, { limit: 10 });

  return (
    <section style={{ marginTop: "2rem" }}>
      <h2 style={{
        fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem",
      }}>
        {ja.job.historyTitle}
      </h2>
      <div style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "0.75rem",
        overflow: "hidden",
      }}>
        {history === undefined ? (
          <p style={{ padding: "1rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
            {ja.common.loading}
          </p>
        ) : history.length === 0 ? (
          <p style={{ padding: "1rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
            {ja.job.noHistory}
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {[ja.job.task, "Agent", "ステータス", ja.job.duration, ja.job.startedAt].map((h) => (
                  <th key={h} style={{
                    padding: "0.5rem 1rem", textAlign: "left",
                    fontSize: "0.7rem", fontWeight: 700,
                    color: "var(--text-muted)", letterSpacing: "0.06em",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(history as JobHistoryRow[]).map((row) => {
                const color = JOB_HISTORY_STATUS_COLOR[row.status] ?? "#6b7280";
                const label = JOB_HISTORY_STATUS_LABEL[row.status] ?? row.status;
                return (
                  <tr key={row._id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem 1rem", fontSize: "0.8rem", color: "var(--text)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.task}
                    </td>
                    <td style={{ padding: "0.5rem 1rem", fontSize: "0.75rem", fontFamily: "monospace", color: "var(--text-muted)" }}>
                      {row.agent_id || ja.common.noData}
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color }}>{label}</span>
                    </td>
                    <td style={{ padding: "0.5rem 1rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {formatDuration(row.duration_ms)}
                    </td>
                    <td style={{ padding: "0.5rem 1rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {formatRelativeTime(row.started_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

// ── DashboardPage ─────────────────────────────────────
export default function DashboardPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allAgents = useQuery(api.queries.getAllAgents);
  const allModels = useQuery(api.queries.getAllModelStatus);
  const recentJobs = useQuery(api.queries.getRecentJobs, { limit: 20 });
  const recentJobEvents = useQuery(api.queries.getRecentJobEvents, { limit: 10 });

  // seed + DB のユニーク agent_id 一覧
  const dbIds    = (allAgents ?? []).map((a) => a.agent_id).filter((id) => !SEED_AGENTS.includes(id));
  const agentIds = [...SEED_AGENTS, ...dbIds];

  // agent_id → AgentRow
  const agentMap = useMemo(
    () => new Map((allAgents ?? []).map((a) => [a.agent_id, a])),
    [allAgents]
  );

  // agent_id → ModelRow[]（updated_at 降順: models[0] が最新）
  const modelMap = useMemo(() => {
    const m = new Map<string, ModelRow[]>();
    for (const row of allModels ?? []) {
      if (!m.has(row.agent_id)) m.set(row.agent_id, []);
      m.get(row.agent_id)!.push(row as ModelRow);
    }
    for (const rows of m.values()) {
      rows.sort((a, b) => b.updated_at - a.updated_at);
    }
    return m;
  }, [allModels]);

  // アクティブ数
  const activeCount = (allAgents ?? []).filter((a) => {
    if (a.status === "stopped") return false;
    return Date.now() - a.last_seen <= DOWN_THRESHOLD_MS;
  }).length;

  const selectedAgent  = selectedId ? agentMap.get(selectedId)  : undefined;
  const selectedModels = selectedId ? (modelMap.get(selectedId) ?? []) : [];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Mission Control</h1>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          {agentIds.length} {ja.common.agents} · {activeCount} {ja.common.active}
        </span>
      </div>

      {/* ── エージェントグリッド ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
        gap: "0.875rem",
        marginBottom: "2rem",
      }}>
        {agentIds.map((id) => (
          <AgentCard
            key={id}
            agentId={id}
            agent={agentMap.get(id)}
            models={modelMap.get(id) ?? []}
            selected={selectedId === id}
            onClick={() => setSelectedId(selectedId === id ? null : id)}
          />
        ))}
      </div>

      {/* ── Recent Activity（横断タイムライン） ── */}
      <section>
        <h2 style={{
          fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)",
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem",
        }}>
          {ja.feed.title}
        </h2>
        <div style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}>
          {recentJobs === undefined || recentJobEvents === undefined ? (
            <p style={{ padding: "1rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>{ja.feed.loading}</p>
          ) : (
            <ActivityFeed jobs={recentJobs as JobRow[]} events={recentJobEvents as JobEventRow[]} />
          )}
        </div>
      </section>

      {/* ── ジョブ履歴 ── */}
      <JobHistorySection />

      {/* ── 詳細パネル ── */}
      {selectedId && (
        <DetailPanel
          agentId={selectedId}
          agent={selectedAgent}
          models={selectedModels}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
