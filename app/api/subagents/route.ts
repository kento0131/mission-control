import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionRow = {
  key?: string;
  kind?: string;
  updatedAt?: number;
  ageMs?: number;
  model?: string;
  agentId?: string;
  sessionId?: string;
  label?: string;
};

type HeartbeatStatus = "running" | "idle" | "stopped";

type HeartbeatPayload = {
  agent_id: string;
  status: HeartbeatStatus;
  current_task?: string;
  current_model?: string;
};

const SUB_AGENT_IDS = ["coding-agent", "designer", "debugger"] as const;

const SUBAGENT_KINDS = new Set(["subagent", "sub-agent", "session", "run"]);

function isLikelySubagent(session: SessionRow): boolean {
  const kind = (session.kind || "").toLowerCase();
  const key = (session.key || "").toLowerCase();
  if (SUBAGENT_KINDS.has(kind)) return true;
  if (key.includes("subagent") || key.includes("sub-agent")) return true;
  // Keep direct/group out explicitly.
  if (kind === "direct" || kind === "group") return false;
  // Unknown kinds are shown to avoid missing future kind names.
  return Boolean(kind && kind !== "direct" && kind !== "group");
}

function statusFromAge(ageMs: number): "running" | "idle" | "stale" {
  if (ageMs <= 2 * 60 * 1000) return "running";
  if (ageMs <= 15 * 60 * 1000) return "idle";
  return "stale";
}

function convexSiteUrlFromEnv(): string | null {
  const direct = process.env.CONVEX_SITE_URL || process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (direct) return direct.replace(/\/$/, "");

  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!cloud) return null;

  try {
    const u = new URL(cloud);
    if (u.hostname.endsWith(".convex.cloud")) {
      u.hostname = u.hostname.replace(/\.convex\.cloud$/, ".convex.site");
    }
    u.pathname = "";
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

async function sendHeartbeat(baseUrl: string, secret: string, payload: HeartbeatPayload): Promise<void> {
  await fetch(`${baseUrl}/api/openclaw/heartbeat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

async function syncSubagentHeartbeats(sessions: SessionRow[]): Promise<void> {
  const secret = process.env.OPENCLAW_SECRET;
  const siteUrl = convexSiteUrlFromEnv();
  if (!secret || !siteUrl) return;

  const runningSessions = sessions
    .map((s) => {
      const ageMs = s.ageMs ?? (s.updatedAt ? Date.now() - s.updatedAt : Number.MAX_SAFE_INTEGER);
      return { ...s, ageMs, status: statusFromAge(ageMs) };
    })
    .filter((s) => s.status === "running")
    .sort((a, b) => a.ageMs - b.ageMs);

  const tasks = SUB_AGENT_IDS.map((agentId, idx) => {
    const hit = runningSessions[idx];
    if (!hit) {
      return sendHeartbeat(siteUrl, secret, {
        agent_id: agentId,
        status: "idle",
        current_task: "",
      });
    }

    const task = (hit.label || hit.key || hit.sessionId || "subagent run").slice(0, 200);
    return sendHeartbeat(siteUrl, secret, {
      agent_id: agentId,
      status: "running",
      current_task: task,
      current_model: hit.model || undefined,
    });
  });

  await Promise.allSettled(tasks);
}

async function markSubagentsIdle(_reason = "待機中"): Promise<void> {
  const secret = process.env.OPENCLAW_SECRET;
  const siteUrl = convexSiteUrlFromEnv();
  if (!secret || !siteUrl) return;

  await Promise.allSettled(
    SUB_AGENT_IDS.map((agent_id) =>
      sendHeartbeat(siteUrl, secret, {
        agent_id,
        status: "idle",
        current_task: "",
      })
    )
  );
}

export async function GET() {
  const remoteSourceUrl = process.env.SUBAGENTS_SOURCE_URL;
  if (remoteSourceUrl) {
    try {
      const res = await fetch(remoteSourceUrl, {
        headers: process.env.SUBAGENTS_SOURCE_TOKEN
          ? { Authorization: `Bearer ${process.env.SUBAGENTS_SOURCE_TOKEN}` }
          : undefined,
        cache: "no-store",
      });
      if (res.ok) {
        const remote = await res.json();
        const remoteItems = Array.isArray(remote?.items) ? (remote.items as SessionRow[]) : [];
        await syncSubagentHeartbeats(remoteItems);
        return Response.json({ ...remote, source: "remote" });
      }
    } catch {
      // fallback to local-openclaw
    }
  }

  try {
    // `--active 2` を基準に「現在稼働中」のみを拾う（未割当スロットを idle 表示にする）
    const { stdout } = await execFileAsync("openclaw", ["sessions", "--json", "--all-agents", "--active", "2"], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });

    const parsed = JSON.parse(stdout) as { sessions?: SessionRow[] };
    const sessions = (parsed.sessions || []).filter(isLikelySubagent);

    const items = sessions
      .map((s) => {
        const ageMs = s.ageMs ?? (s.updatedAt ? Date.now() - s.updatedAt : Number.MAX_SAFE_INTEGER);
        return {
          key: s.key || s.sessionId || "unknown",
          label: s.label || s.key || s.sessionId || "subagent",
          kind: s.kind || "unknown",
          model: s.model || "—",
          agentId: s.agentId || "main",
          updatedAt: s.updatedAt || null,
          ageMs,
          status: statusFromAge(ageMs),
        };
      })
      .sort((a, b) => a.ageMs - b.ageMs);

    await syncSubagentHeartbeats(sessions);
    return Response.json({ ts: Date.now(), count: items.length, items, source: "local-openclaw" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";

    // Vercel/Serverless 環境では openclaw バイナリが存在しないため、機能非対応として返す
    if (code === "ENOENT" || /spawn\s+openclaw\s+ENOENT/i.test(message)) {
      await markSubagentsIdle("待機中");
      return Response.json(
        {
          ts: Date.now(),
          count: 0,
          items: [],
          unsupported: true,
          reason: "Subagent monitor requires an OpenClaw-installed host runtime.",
          source: "none",
        },
        { status: 200 }
      );
    }

    await markSubagentsIdle("取得待機");
    return Response.json({ ts: Date.now(), count: 0, items: [], error: "subagent source unavailable", detail: message, source: "error" }, { status: 200 });
  }
}
