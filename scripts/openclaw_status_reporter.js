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
 *   OPENCLAW_SECRET     (必須) Bearer トークン (64 hex)
 *   AGENT_ID            (任意) デフォルト: "openclaw-main"
 *   CONVEX_SITE_URL     (任意) デフォルト: https://opulent-clam-873.convex.site
 *   CURRENT_TASK        (任意) heartbeat の current_task。日本語可。
 *   CURRENT_MODEL       (任意) 自動検出に失敗した場合のフォールバック
 *   REMAINING_PERCENT   (任意) openclaw コマンドが使えない環境向けの手動指定 (0-100)
 *   REMAINING_DAY_PCT   (任意) 同上、当日残量 (0-100)
 *   INTERVAL_SEC        (任意) ポーリング間隔秒数、デフォルト 5
 */

import { execSync } from "node:child_process";

// ── サニタイズ ─────────────────────────────────────────
/**
 * ASCII identifier 用: 表示可能 ASCII のみ残す（secret / agent_id / URL 向け）。
 * 日本語などのマルチバイト文字は除去される点に注意。
 */
const sanitizeAscii = (v) => (v ?? "").replace(/[^\x20-\x7E]/g, "").trim();

/**
 * 汎用テキスト用: 制御文字 (0x00-0x1F, 0x7F) のみ除去し、
 * 日本語 / emoji などの Unicode 文字は保持する。
 * current_task / current_model など表示用フィールドに使用する。
 */
const sanitizeText = (v) => (v ?? "").replace(/[\x00-\x1F\x7F]/g, "").trim();

// ── 設定 ──────────────────────────────────────────────
const CONVEX_SITE_URL =
  sanitizeAscii(process.env.CONVEX_SITE_URL) || "https://opulent-clam-873.convex.site";
const INTERVAL_MS = Number(process.env.INTERVAL_SEC ?? 5) * 1000;
const AGENT_ID    = sanitizeAscii(process.env.AGENT_ID) || "openclaw-main";
const HEARTBEAT_ENABLED = String(process.env.HEARTBEAT_ENABLED ?? "true").toLowerCase() !== "false";
const MODEL_STATUS_ENABLED = String(process.env.MODEL_STATUS_ENABLED ?? "true").toLowerCase() !== "false";
const HEARTBEAT_STATUS = sanitizeAscii(process.env.HEARTBEAT_STATUS) || "running";
const OPENCLAW_CMD = sanitizeAscii(process.env.OPENCLAW_CMD) || "openclaw";

const secret = sanitizeAscii(process.env.OPENCLAW_SECRET);
if (!secret) {
  console.error("ERROR: OPENCLAW_SECRET environment variable is not set.");
  console.error("  PowerShell : $env:OPENCLAW_SECRET='your-token'");
  console.error("  bash       : export OPENCLAW_SECRET='your-token'");
  process.exit(1);
}
if (!/^[0-9a-f]{64}$/i.test(secret)) {
  console.error(`ERROR: OPENCLAW_SECRET is invalid (got ${secret.length} chars, expected 64 hex).`);
  console.error("  Possible cause: trailing newline or invisible character from pm2/env file.");
  process.exit(1);
}

// ── openclaw models status パーサー ───────────────────
/**
 * `openclaw models status` の出力テキストを解析して返す。
 *
 * 対応フォーマット（複数形式):
 *   Default: <model>                         → model 名
 *   Model: <model>                           → model 名 (別形式)
 *   usage: <N>% left                         → remaining_percent
 *   Day <N>% left                            → remaining_day_percent
 *   <N>% remaining                           → remaining_percent (別形式)
 *   remaining: <N>%                          → remaining_percent (別形式)
 *   Quota: <N>% used → 100-N を計算          → remaining_percent
 */
function parseOpenclawModelsStatus(text) {
  const result = {
    model: null,
    remaining_percent: null,
    remaining_day_percent: null,
    raw: text.trim(),
  };

  // model 名取得 (複数パターン)
  const defaultMatch = text.match(/Default:\s*(.+)/i);
  if (defaultMatch) result.model = sanitizeText(defaultMatch[1]);

  if (!result.model) {
    const modelMatch = text.match(/^Model:\s*(.+)/im);
    if (modelMatch) result.model = sanitizeText(modelMatch[1]);
  }
  if (!result.model) {
    const currentMatch = text.match(/Current(?:\s+model)?:\s*(.+)/i);
    if (currentMatch) result.model = sanitizeText(currentMatch[1]);
  }

  // remaining_percent (複数パターン)
  const usageMatch = text.match(/usage:\s*(\d+(?:\.\d+)?)%\s*left/i);
  if (usageMatch) result.remaining_percent = parseFloat(usageMatch[1]);

  if (result.remaining_percent === null) {
    const remainMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*remaining/i);
    if (remainMatch) result.remaining_percent = parseFloat(remainMatch[1]);
  }
  if (result.remaining_percent === null) {
    const remainMatch2 = text.match(/remaining:\s*(\d+(?:\.\d+)?)%/i);
    if (remainMatch2) result.remaining_percent = parseFloat(remainMatch2[1]);
  }
  if (result.remaining_percent === null) {
    // "Quota: N% used" → 100 - N
    const quotaMatch = text.match(/[Qq]uota:\s*(\d+(?:\.\d+)?)%\s*used/i);
    if (quotaMatch) result.remaining_percent = Math.max(0, 100 - parseFloat(quotaMatch[1]));
  }

  // remaining_day_percent
  const dayMatch = text.match(/Day\s+(\d+(?:\.\d+)?)%\s*left/i);
  if (dayMatch) result.remaining_day_percent = parseFloat(dayMatch[1]);

  if (result.remaining_day_percent === null) {
    const dayMatch2 = text.match(/[Dd]aily.*?(\d+(?:\.\d+)?)%/);
    if (dayMatch2) result.remaining_day_percent = parseFloat(dayMatch2[1]);
  }

  return result;
}

function runOpenclawModelsStatus() {
  try {
    const raw = execSync(`${OPENCLAW_CMD} models status`, {
      timeout: 30_000,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return parseOpenclawModelsStatus(raw);
  } catch (err) {
    const stderr = String(err?.stderr ?? "");
    const msg = String(err?.message ?? "");
    const status = err?.status ?? "?";
    const signal = err?.signal ?? "";
    const detail = `${msg} ${stderr}`.trim();
    if (!detail.includes("not found") && !detail.includes("ENOENT")) {
      console.error(`[reporter] openclaw models status failed: status=${status} signal=${signal} ${detail}`.slice(0, 400));
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
        "Content-Type": "application/json; charset=utf-8",
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

  // current_model の決定順: openclaw 出力 → CURRENT_MODEL env → "unknown"
  const currentModel = sanitizeText(
    parsed?.model ?? process.env.CURRENT_MODEL ?? "unknown"
  );
  // current_task: 日本語対応のため sanitizeText を使用
  const currentTask = sanitizeText(process.env.CURRENT_TASK ?? "monitoring");

  // heartbeat (optional)
  if (HEARTBEAT_ENABLED) {
    await post("/api/openclaw/heartbeat", {
      agent_id:      AGENT_ID,
      status:        HEARTBEAT_STATUS,
      current_task:  currentTask,
      current_model: currentModel,
    });
  }

  // model_status の決定:
  //   1. openclaw コマンドで取得できた場合
  //   2. env var REMAINING_PERCENT が設定されている場合（コマンド利用不可環境向け）
  let remainingPercent    = parsed?.remaining_percent ?? null;
  let remainingDayPercent = parsed?.remaining_day_percent ?? null;

  // env var フォールバック
  if (remainingPercent === null && process.env.REMAINING_PERCENT !== undefined) {
    remainingPercent = parseFloat(process.env.REMAINING_PERCENT);
  }
  if (remainingDayPercent === null && process.env.REMAINING_DAY_PCT !== undefined) {
    remainingDayPercent = parseFloat(process.env.REMAINING_DAY_PCT);
  }

  if (!MODEL_STATUS_ENABLED) return;

  if (remainingPercent !== null && !isNaN(remainingPercent)) {
    const payload = {
      agent_id:          AGENT_ID,
      model:             currentModel,
      remaining_percent: remainingPercent,
      raw:               parsed?.raw ?? `manual:${remainingPercent}%`,
    };
    if (remainingDayPercent !== null && !isNaN(remainingDayPercent)) {
      payload.remaining_day_percent = remainingDayPercent;
    }
    await post("/api/openclaw/model_status", payload);

    const dayStr =
      remainingDayPercent !== null
        ? ` / Day ${remainingDayPercent}%`
        : "";
    console.log(
      `[${new Date().toISOString()}] [${AGENT_ID}] ${currentModel}  usage ${remainingPercent}%${dayStr}`
    );
  } else {
    console.log(
      `[${new Date().toISOString()}] [${AGENT_ID}] model status unavailable` +
      ` — set REMAINING_PERCENT=<0-100> env var to force model_status reporting`
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
    agent_id:      AGENT_ID,
    status:        "stopped",
    current_task:  "idle",
    current_model: sanitizeText(process.env.CURRENT_MODEL ?? "unknown"),
  });
  console.log("Stopped. Exiting.");
  process.exit(0);
}

process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ── 起動 ──────────────────────────────────────────────
console.log(`openclaw_status_reporter starting  agent=${AGENT_ID}  interval=${INTERVAL_MS / 1000}s`);
console.log(`Endpoint: ${CONVEX_SITE_URL}`);
console.log(`heartbeat=${HEARTBEAT_ENABLED ? HEARTBEAT_STATUS : "off"} model_status=${MODEL_STATUS_ENABLED ? "on" : "off"}`);
console.log("Press Ctrl+C to stop.\n");

report();
timer = setInterval(() => { if (!shuttingDown) report(); }, INTERVAL_MS);
