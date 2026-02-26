#!/usr/bin/env node
/**
 * Mission Control Heartbeat
 * 5 秒ごとに heartbeat POST を送信する。
 * SIGINT / SIGTERM で status:"stopped" を送信してから終了。
 *
 * Usage (PowerShell):
 *   $env:OPENCLAW_SECRET = "your-token"
 *   node scripts/mission_control_heartbeat.js
 *
 * 環境変数:
 *   OPENCLAW_SECRET   (必須)
 *   AGENT_ID          (任意) デフォルト: "openclaw-main"
 *   CONVEX_SITE_URL   (任意) デフォルト: https://reliable-jay-929.convex.site
 *   CURRENT_TASK      (任意)
 *   CURRENT_MODEL     (任意) 未設定時は自動検出
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONVEX_SITE_URL =
  process.env.CONVEX_SITE_URL ?? "https://reliable-jay-929.convex.site";
const ENDPOINT    = `${CONVEX_SITE_URL}/api/openclaw/heartbeat`;
const INTERVAL_MS = 5000;
const AGENT_ID    = process.env.AGENT_ID ?? "openclaw-main";

const secret = process.env.OPENCLAW_SECRET;
if (!secret) {
  console.error("ERROR: OPENCLAW_SECRET environment variable is not set.");
  console.error("  PowerShell: $env:OPENCLAW_SECRET='your-token'");
  process.exit(1);
}

// ── current_model 自動検出 ──────────────────────────────
function detectCurrentModel() {
  if (process.env.CURRENT_MODEL) return process.env.CURRENT_MODEL;
  for (const key of ["OPENCLAW_MODEL", "CLAUDE_MODEL", "ANTHROPIC_MODEL", "AI_MODEL"]) {
    if (process.env[key]) return process.env[key];
  }
  try {
    const p = join(homedir(), ".openclaw", "config.json");
    if (existsSync(p)) { const c = JSON.parse(readFileSync(p, "utf8")); if (c.model) return c.model; }
  } catch {}
  try {
    const out = execSync("openclaw config --json 2>/dev/null", { timeout: 3000, encoding: "utf8" });
    const c = JSON.parse(out);
    if (c.model) return c.model;
  } catch {}
  return "unknown";
}

const currentModel = detectCurrentModel();
console.log(`Agent: ${AGENT_ID}  Model: ${currentModel}`);

// ── heartbeat 送信 ─────────────────────────────────────
async function sendHeartbeat(status = "running", task = undefined) {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        status,
        current_task: task ?? process.env.CURRENT_TASK ?? "heartbeat",
        current_model: currentModel,
      }),
    });
    const text = await res.text();
    if (res.ok) {
      console.log(`[${new Date().toISOString()}] ${status.toUpperCase()} ${res.status} — ${text}`);
    } else {
      console.error(`[${new Date().toISOString()}] ERROR ${res.status} — ${text}`);
    }
    return res.ok;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] FETCH FAILED — ${err.message}`);
    return false;
  }
}

// ── シャットダウン ─────────────────────────────────────
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(timer);
  console.log(`\n[${new Date().toISOString()}] ${signal} — sending stopped...`);
  await sendHeartbeat("stopped", "idle");
  console.log("Stopped. Exiting.");
  process.exit(0);
}

process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ── 起動 ──────────────────────────────────────────────
console.log(`Sending heartbeat to ${ENDPOINT} every ${INTERVAL_MS / 1000}s`);
console.log("Press Ctrl+C to stop.\n");

sendHeartbeat();
const timer = setInterval(() => { if (!shuttingDown) sendHeartbeat(); }, INTERVAL_MS);
