#!/usr/bin/env node
/**
 * Mission Control — Model Status 送信スクリプト（手動テスト用）
 *
 * Usage (PowerShell):
 *   $env:OPENCLAW_SECRET = "your-token"
 *   node scripts/mission_control_model_status.js --model claude-opus-4-5 --percent 72
 *   node scripts/mission_control_model_status.js --model gpt-4o --percent 45 --day-percent 80 --agent-id discord-bot
 *
 * 環境変数:
 *   OPENCLAW_SECRET   (必須)
 *   AGENT_ID          (任意) デフォルト: "openclaw-main"（--agent-id で上書き可）
 *   CONVEX_SITE_URL   (任意)
 */

const CONVEX_SITE_URL =
  process.env.CONVEX_SITE_URL ?? "https://reliable-jay-929.convex.site";
const ENDPOINT = `${CONVEX_SITE_URL}/api/openclaw/model_status`;

const secret = process.env.OPENCLAW_SECRET;
if (!secret) {
  console.error("ERROR: OPENCLAW_SECRET environment variable is not set.");
  process.exit(1);
}

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const model      = getArg("model");
const percentStr = getArg("percent");
const dayStr     = getArg("day-percent");
const raw        = getArg("raw");
const agentId    = getArg("agent-id") ?? process.env.AGENT_ID ?? "openclaw-main";

if (!model || percentStr === undefined) {
  console.error(
    "Usage: node scripts/mission_control_model_status.js --model <name> --percent <0-100> [--day-percent <0-100>] [--agent-id <id>] [--raw <string>]"
  );
  process.exit(1);
}

const remaining_percent = Number(percentStr);
if (isNaN(remaining_percent) || remaining_percent < 0 || remaining_percent > 100) {
  console.error("ERROR: --percent must be 0-100"); process.exit(1);
}
const remaining_day_percent = dayStr !== undefined ? Number(dayStr) : undefined;

async function send() {
  const body = {
    agent_id: agentId,
    model,
    remaining_percent,
    ...(remaining_day_percent !== undefined ? { remaining_day_percent } : {}),
    ...(raw ? { raw } : {}),
  };
  console.log(`POST ${ENDPOINT}`);
  console.log(`Body: ${JSON.stringify(body)}`);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (res.ok) { console.log(`OK ${res.status} — ${text}`); }
    else { console.error(`ERROR ${res.status} — ${text}`); process.exit(1); }
  } catch (err) {
    console.error(`FETCH FAILED — ${err.message}`); process.exit(1);
  }
}

send();
