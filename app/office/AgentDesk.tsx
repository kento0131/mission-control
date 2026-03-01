"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getEffectiveStatus } from "../components/AgentStatusCard";
import { formatRelativeTime } from "../../lib/utils";

type AgentRow = {
  agent_id: string;
  status: string;
  last_seen: number;
  current_task?: string;
  current_model?: string;
};

type EffStatus = "running" | "idle" | "stopped" | "down";

// ── 画面コンポーネント（PCモニター） ───────────────────
function Screen({ status }: { status: EffStatus }) {
  const screenStyle: React.CSSProperties = {
    width: 80,
    height: 52,
    borderRadius: 6,
    border: "3px solid",
    borderColor:
      status === "running" ? "#22c55e"
      : status === "idle"    ? "#eab308"
      : status === "stopped" ? "#6b7280"
      : "#374151",
    backgroundColor:
      status === "running" ? "rgba(34,197,94,0.08)"
      : status === "idle"   ? "rgba(234,179,8,0.06)"
      : "rgba(0,0,0,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    animation:
      status === "running" ? "screen-running 2s ease-in-out infinite"
      : status === "idle"   ? "screen-idle 3s ease-in-out infinite"
      : undefined,
    transition: "all 0.4s ease",
  };

  return (
    <div style={screenStyle}>
      {status === "running" && <TypingIndicator />}
      {status === "idle"    && <IdleIndicator />}
      {status === "stopped" && <StoppedIndicator />}
      {status === "down"    && <DownIndicator />}

      {/* モニタースタンド */}
      <div style={{
        position: "absolute",
        bottom: -10,
        left: "50%",
        transform: "translateX(-50%)",
        width: 24,
        height: 8,
        backgroundColor: "#374151",
        borderRadius: "0 0 4px 4px",
      }} />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "#22c55e",
            animation: `typing-cursor 1s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function IdleIndicator() {
  return (
    <div style={{
      width: 10, height: 10, borderRadius: "50%",
      backgroundColor: "#eab308",
      animation: "screen-idle 2s ease-in-out infinite",
    }} />
  );
}

function StoppedIndicator() {
  return (
    <div style={{ fontSize: "1.25rem", opacity: 0.5 }}>—</div>
  );
}

function DownIndicator() {
  return (
    <div style={{ fontSize: "0.7rem", color: "#ef4444", fontWeight: 700, opacity: 0.7 }}>
      N/A
    </div>
  );
}

// ── Ripple（RUNNING 時のデスク周囲波紋） ───────────────
function RippleRing() {
  return (
    <div style={{
      position: "absolute",
      inset: -4,
      borderRadius: 16,
      border: "2px solid rgba(34,197,94,0.4)",
      animation: "ripple 2s ease-out infinite",
      pointerEvents: "none",
    }} />
  );
}

// ── ステータスラベル ──────────────────────────────────
const statusLabel: Record<EffStatus, string> = {
  running: "RUNNING",
  idle:    "IDLE",
  stopped: "STOPPED",
  down:    "DOWN",
};
const statusColor: Record<EffStatus, string> = {
  running: "#22c55e",
  idle:    "#eab308",
  stopped: "#6b7280",
  down:    "#ef4444",
};

// ── AgentDesk ─────────────────────────────────────────
export function AgentDesk({
  agentId,
  agent,
  onClick,
}: {
  agentId: string;
  agent: AgentRow | null;
  onClick: () => void;
}) {
  const effectiveStatus = getEffectiveStatus(agent) as EffStatus;
  const isDown    = effectiveStatus === "down";
  const isStopped = effectiveStatus === "stopped";

  // このエージェントのモデルステータスを取得（残量表示用）
  const models = useQuery(api.queries.getModelStatusForAgent, { agent_id: agentId });

  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        backgroundColor: "var(--bg-card)",
        border: "1px solid",
        borderColor:
          effectiveStatus === "running" ? "rgba(34,197,94,0.3)"
          : effectiveStatus === "idle"  ? "rgba(234,179,8,0.2)"
          : "var(--border)",
        borderRadius: 16,
        padding: "1.5rem 1.25rem 1.25rem",
        cursor: "pointer",
        transition: "all 0.2s ease",
        opacity: isDown || isStopped ? 0.6 : 1,
        animation: "desk-fade-in 0.3s ease",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.875rem",
        userSelect: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--bg-card-hover)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--bg-card)";
      }}
    >
      {effectiveStatus === "running" && <RippleRing />}

      {/* PC スクリーン */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <Screen status={effectiveStatus} />
      </div>

      {/* デスク面 */}
      <div style={{
        width: "100%",
        height: 6,
        borderRadius: 4,
        backgroundColor: isDown ? "#1f2937" : "#1e293b",
        marginTop: -4,
      }} />

      {/* Agent ID — agentId prop を使う（agent が null でも名前を表示） */}
      <p style={{
        fontSize: "0.8125rem",
        fontWeight: 600,
        fontFamily: "monospace",
        color: isDown ? "var(--text-muted)" : "var(--text)",
        textAlign: "center",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {agentId}
      </p>

      {/* ステータス */}
      <span style={{
        fontSize: "0.7rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: statusColor[effectiveStatus],
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          backgroundColor: statusColor[effectiveStatus],
          flexShrink: 0,
        }} />
        {statusLabel[effectiveStatus]}
      </span>

      {/* current_task（短縮表示） */}
      {agent?.current_task && effectiveStatus === "running" && (
        <p style={{
          fontSize: "0.7rem",
          color: "var(--text-muted)",
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "100%",
          marginTop: -4,
        }}>
          {agent.current_task}
        </p>
      )}

      {/* 残量% / day%（RUNNING / IDLE 時、モデルデータがあれば） */}
      {!isDown && !isStopped && models && models.length > 0 && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 3, marginTop: -4 }}>
          {models.slice(0, 1).map((m) => (
            <div key={m._id}>
              <MiniPercent label="5時間枠" value={m.remaining_percent} />
              {m.remaining_day_percent !== undefined && (
                <MiniPercent label="24時間枠" value={m.remaining_day_percent} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Last seen（DOWN/STOPPED 時） */}
      {agent?.last_seen && (isDown || isStopped) && (
        <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: -4 }}>
          {formatRelativeTime(agent.last_seen)}
        </p>
      )}
    </div>
  );
}

function MiniPercent({ label, value }: { label: string; value: number }) {
  const color = value > 20 ? "#22c55e" : value > 5 ? "#eab308" : "#ef4444";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: "0.7rem", fontWeight: 700, color }}>{value}%</span>
    </div>
  );
}
