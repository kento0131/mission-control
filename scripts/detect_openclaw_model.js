#!/usr/bin/env node
/**
 * detect_openclaw_model.js
 * openclaw が現在使用しているモデル名を検出して標準出力に出力する。
 *
 * Usage:
 *   node scripts/detect_openclaw_model.js
 *   # 出力例: claude-opus-4-5
 *
 * 検出順序:
 *   1) 環境変数: CURRENT_MODEL, OPENCLAW_MODEL, CLAUDE_MODEL, ANTHROPIC_MODEL
 *   2) ~/.openclaw/config.json → .model
 *   3) ./openclaw.config.json  → .model
 *   4) openclaw CLI: `openclaw config --json` → .model
 *   5) フォールバック: "unknown"
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const verbose = process.argv.includes("--verbose");

function log(msg) {
  if (verbose) console.error(`[detect] ${msg}`);
}

function tryEnvVars() {
  for (const key of [
    "CURRENT_MODEL",
    "OPENCLAW_MODEL",
    "CLAUDE_MODEL",
    "ANTHROPIC_MODEL",
    "AI_MODEL",
    "MODEL_NAME",
  ]) {
    if (process.env[key]) {
      log(`Found via env ${key}: ${process.env[key]}`);
      return process.env[key];
    }
  }
  return null;
}

function tryConfigFile(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    const cfg = JSON.parse(readFileSync(filePath, "utf8"));
    const model = cfg.model ?? cfg.default_model ?? cfg.defaultModel ?? null;
    if (model) log(`Found in ${filePath}: ${model}`);
    return model ?? null;
  } catch (e) {
    log(`Failed to read ${filePath}: ${e.message}`);
    return null;
  }
}

function tryCli() {
  const commands = [
    "openclaw config --json",
    "openclaw models current",
    "openclaw status --json",
  ];
  for (const cmd of commands) {
    try {
      const out = execSync(cmd, { timeout: 3000, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
      // JSON パース試行
      try {
        const parsed = JSON.parse(out.trim());
        const model =
          parsed.model ??
          parsed.current_model ??
          parsed.defaultModel ??
          null;
        if (model) {
          log(`Found via CLI "${cmd}": ${model}`);
          return model;
        }
      } catch {
        // JSON でなければ trim した値をそのまま使う（単純な文字列出力の場合）
        const trimmed = out.trim();
        if (trimmed && !trimmed.includes(" ") && trimmed.length < 80) {
          log(`Found via CLI "${cmd}" (raw): ${trimmed}`);
          return trimmed;
        }
      }
    } catch {
      log(`CLI command failed: ${cmd}`);
    }
  }
  return null;
}

function detect() {
  return (
    tryEnvVars() ??
    tryConfigFile(join(homedir(), ".openclaw", "config.json")) ??
    tryConfigFile(join(process.cwd(), "openclaw.config.json")) ??
    tryConfigFile(join(process.cwd(), ".openclaw")) ??
    tryCli() ??
    "unknown"
  );
}

const model = detect();
console.log(model);
process.exit(model === "unknown" ? 1 : 0);
