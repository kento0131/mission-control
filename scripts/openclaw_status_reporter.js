#!/usr/bin/env node
/**
 * openclaw_status_reporter.js
 *
 * 5 秒ごとに `openclaw models status` を実行し、
 * 解析結果を Mission Control に送信する常駐スクリプト。
 *
 * 送信内容:
 *   POST /api/openclaw/heartbeat   { agent_id, status, current_task, current_model }
 *   POST /api/openclaw/model_status { agent_id, model, remaining_percent, remaining_day_percent, raw }
 *
 * SIGINT (Ctrl+C) / SIGTERM (pm2 stop) 受信時:
 *   status:"stopped" を送信してから終了。
 *
 * Usage (PowerShell / bash):
 *   $env:OPENCLAW_SECRET = "your-token"          # PowerShell
 *   export OPENCLAW_SECRET="your-token"           # bash
 *   node scripts/openclaw_status_reporter.js
 *
 * 環境変数:
 *   OPENCLAW_SECRET   (必須) Bearer トークン
 *   AGENT_ID          (任意) デフォルト: "openclaw-main"
 *   CONVEX_SITE_URL   (任意) デフォルト: https://reliable-jay-929.convex.site
 *   CURRENT_TASK      (任意) heartbeat の current_task
 *   INTERVAL_SEC      (任意) ポーリング間隔秒数、デフォルト 5
 */

import { execSync } from "node:child_process";

// ── 設定 ──────────────────────────────────────────────
const CONVEX_SITE_URL =
  process.env.CONVEX_SITE_URL ?? "https://reliable-jay-929.convex.site";
const INTERVAL_MS = Number(process.env.INTERVAL_SEC ?? 5) * 1000;
const AGENT_ID = process.env.AGENT_ID ?? "openclaw-main";

const secret = process.env.OPENCLAW_SECRET;
if (!secret) {
  console.error("ERROR: OPENCLAW_SECRET environment variable is not set.");
  console.error("  PowerShell : $env:OPENCLAW_SECRET='your-token'");
  console.error("  bash       : export OPENCLAW_SECRET='your-token'");
  process.exit(1);
}

// ── openclaw models status パーサー ───────────────────
/**
 * `openclaw models status` の出力テキストを解析して返す。
 *
 * 対象パターン:
 *   Default: <model>
 *   openai-codex usage: <N>% left
 *   Day <N>% left
 */
function parseOpenclawModelsStatus(text) {
  const result = {
    model: null,
    remaining_percent: null,
    remaining_day_percent: null,
    raw: text.trim(),
  };

  const defaultMatch = text.match(/Default:\s*(.+)/);
  if (defaultMatch) result.model = defaultMatch[1].trim();

  const usageMatch = text.match(/usage:\s*(\d+(?:\.\d+)?)%\s*left/i);
  if (usageMatch) result.remaining_percent = parseFloat(usageMatch[1]);

  const dayMatch = text.match(/Day\s+(\d+(?:\.\d+)?)%\s*left/i);
  if (dayMatch) result.remaining_day_percent = parseFloat(dayMatch[1]);

  return result;
}

function runOpenclawModelsStatus() {
  try {
    const raw = execSync("openclaw models status", {
      timeout: 10_000,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return parseOpenclawModelsStatus(raw);
  } catch (err) {
    const msg = err.stderr ?? err.message ?? "";
    if (!msg.includes("not found") && !msg.includes("ENOENT")) {
      console.error(`[reporter] openclaw models status failed: ${msg.slice(0, 120)}`);
    }
    return null;
  }
}

// ── HTTP 送信ヘルパー ─────────────────────────────────
async function post(path, body) {
  const url = `${CONVEX_SITE_URL}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[reporter] POST ${path} ${res.status} — ${text}`);
    }
    return res.ok;
  } catch (err) {
    console.error(`[reporter] POST ${path} FAILED — ${err.message}`);
    return false;
  }
}

// ── メインループ ──────────────────────────────────────
let shuttingDown = false;
let timer;

async function report() {
  const parsed = runOpenclawModelsStatus();

  const currentModel = parsed?.model ?? process.env.CURRENT_MODEL ?? "unknown";
  const currentTask  = process.env.CURRENT_TASK ?? "monitoring";

  // heartbeat
  await post("/api/openclaw/heartbeat", {
    agent_id: AGENT_ID,
    status: "running",
    current_task: currentTask,
    current_model: currentModel,
  });

  // model_status（解析できた場合のみ）
  if (parsed && parsed.remaining_percent !== null) {
    const payload = {
      agent_id: AGENT_ID,
      model: currentModel,
      remaining_percent: parsed.remaining_percent,
      raw: parsed.raw,
    };
    if (parsed.remaining_day_percent !== null) {
      payload.remaining_day_percent = parsed.remaining_day_percent;
    }
    await post("/api/openclaw/model_status", payload);

    const dayStr =
      parsed.remaining_day_percent !== null
        ? ` / Day ${parsed.remaining_day_percent}%`
        : "";
    console.log(
      `[${new Date().toISOString()}] [${AGENT_ID}] ${currentModel}  usage ${parsed.remaining_percent}%${dayStr}`
    );
  } else {
    console.log(
      `[${new Date().toISOString()}] [${AGENT_ID}] heartbeat sent (model status unavailable)`
    );
  }
}

// ── シャットダウン ─────────────────────────────────────
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(timer);

  console.log(`\n[${new Date().toISOString()}] ${signal} — sending stopped...`);
  await post("/api/openclaw/heartbeat", {
    agent_id: AGENT_ID,
    status: "stopped",
    current_task: "idle",
    current_model: process.env.CURRENT_MODEL ?? "unknown",
  });
  console.log("Stopped. Exiting.");
  process.exit(0);
}

process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ── 起動 ──────────────────────────────────────────────
console.log(`openclaw_status_reporter starting  agent=${AGENT_ID}  interval=${INTERVAL_MS / 1000}s`);
console.log(`Endpoint: ${CONVEX_SITE_URL}`);
console.log("Press Ctrl+C to stop.\n");

report();
timer = setInterval(() => { if (!shuttingDown) report(); }, INTERVAL_MS);
