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

export async function GET() {
  try {
    const { stdout } = await execFileAsync("openclaw", ["sessions", "--json", "--all-agents", "--active", "240"], {
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

    return Response.json({ ts: Date.now(), count: items.length, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ts: Date.now(), count: 0, items: [], error: message }, { status: 200 });
  }
}
