import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parse(text: string) {
  const model = text.match(/^Default\s*:\s*(.+)$/im)?.[1]?.trim() || "openai-codex/gpt-5.3-codex";
  const usage = text.match(/usage:\s*(?:\d+h\s*)?(\d+(?:\.\d+)?)%\s*left/i)?.[1];
  const day = text.match(/Day\s+(\d+(?:\.\d+)?)%\s*left/i)?.[1];
  return {
    model,
    remaining_percent: usage ? Number(usage) : null,
    remaining_day_percent: day ? Number(day) : null,
  };
}

function getConvexUrl() {
  return process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "";
}

async function readLatestFromConvex() {
  const convexUrl = getConvexUrl();
  if (!convexUrl) return null;
  const client = new ConvexHttpClient(convexUrl);
  const rows = await client.query(api.queries.getAllModelStatus, {});
  const filtered = (rows || []).filter((r: any) => r.agent_id === "openclaw-main");
  if (!filtered.length) return null;
  filtered.sort((a: any, b: any) => (b.updated_at ?? 0) - (a.updated_at ?? 0));
  const top = filtered[0] as any;
  return {
    model: top.model,
    remaining_percent: top.remaining_percent,
    remaining_day_percent: top.remaining_day_percent,
    ts: Date.now(),
    source: "convex-latest",
  };
}

export async function POST() {
  try {
    const { stdout } = await execFileAsync("openclaw", ["models", "status"], { timeout: 15000, maxBuffer: 1024 * 1024 });
    const parsed = parse(stdout);
    if (parsed.remaining_percent === null) {
      const fallback = await readLatestFromConvex();
      if (fallback) return Response.json({ ok: true, ...fallback });
      return Response.json({ ok: false, error: "parse_failed" }, { status: 200 });
    }
    return Response.json({ ok: true, ts: Date.now(), ...parsed, source: "local-openclaw" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);

    // Serverless などで openclaw が使えない場合は Convex の最新値を返す
    if (/ENOENT|spawn\s+openclaw/i.test(msg)) {
      try {
        const fallback = await readLatestFromConvex();
        if (fallback) return Response.json({ ok: true, ...fallback });
      } catch {
        // continue to error
      }
      return Response.json({ ok: false, unsupported: true, error: "openclaw_unavailable" }, { status: 200 });
    }

    return Response.json({ ok: false, error: "refresh_failed", detail: msg }, { status: 200 });
  }
}
