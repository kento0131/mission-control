import { execFile } from "node:child_process";
import { promisify } from "node:util";

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

export async function POST() {
  try {
    const { stdout } = await execFileAsync("openclaw", ["models", "status"], { timeout: 15000, maxBuffer: 1024 * 1024 });
    const parsed = parse(stdout);
    if (parsed.remaining_percent === null) {
      return Response.json({ ok: false, error: "parse_failed" }, { status: 200 });
    }
    return Response.json({ ok: true, ts: Date.now(), ...parsed, source: "local-openclaw" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/ENOENT|spawn\s+openclaw/i.test(msg)) {
      return Response.json({ ok: false, unsupported: true, error: "openclaw_unavailable" }, { status: 200 });
    }
    return Response.json({ ok: false, error: "refresh_failed", detail: msg }, { status: 200 });
  }
}
