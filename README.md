# Mission Control

OpenClaw AI エージェントの進捗をリアルタイムで可視化する Next.js + Convex ダッシュボード。

## 画面一覧

| パス | 内容 |
|---|---|
| `/dashboard` | エージェント選択 + Status / Model Status + Recent Jobs |
| `/office` | デスクグリッド（全エージェントを一覧）+ クリックで詳細パネル |
| `/jobs` | ジョブ一覧 |
| `/jobs/[id]` | ジョブ詳細 + ログ |

---

## agent_id について

すべてのエンドポイントで `agent_id` を body に含める。
省略した場合は `"openclaw-main"` として扱われる（後方互換）。

### 命名規則（例）

| agent_id | 用途 |
|---|---|
| `openclaw-main` | メイン AI エージェント |
| `discord-bot` | Discord Bot |
| `calendar-worker` | カレンダーワーカー |

---

## HTTP API エンドポイント

ベースURL: `https://reliable-jay-929.convex.site`
認証: `Authorization: Bearer <OPENCLAW_SECRET>`

### POST /api/openclaw/heartbeat

```json
{
  "agent_id": "openclaw-main",
  "status": "running",
  "current_task": "データ収集中",
  "current_model": "openai-codex"
}
```

`status` は `"running"` / `"idle"` / `"stopped"` のいずれか。

### POST /api/openclaw/model_status

```json
{
  "agent_id": "openclaw-main",
  "model": "openai-codex",
  "remaining_percent": 73,
  "remaining_day_percent": 45,
  "raw": "openai-codex usage: 73% left\nDay 45% left"
}
```

### POST /api/openclaw/jobStart / jobFinish / jobFail / appendLog

```json
{ "job_id": "job-001", "title": "サイトクロール" }
```

---

## curl 送信例

```bash
CONVEX_URL=https://reliable-jay-929.convex.site
TOKEN=your-secret-token

# heartbeat — openclaw-main
curl -X POST $CONVEX_URL/api/openclaw/heartbeat \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"agent_id":"openclaw-main","status":"running","current_task":"監視中","current_model":"openai-codex"}'

# heartbeat — discord-bot
curl -X POST $CONVEX_URL/api/openclaw/heartbeat \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"agent_id":"discord-bot","status":"idle"}'

# stopped を送信（Ctrl+C 相当）
curl -X POST $CONVEX_URL/api/openclaw/heartbeat \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"agent_id":"openclaw-main","status":"stopped"}'

# model_status
curl -X POST $CONVEX_URL/api/openclaw/model_status \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"agent_id":"openclaw-main","model":"openai-codex","remaining_percent":73,"remaining_day_percent":45}'
```

---

## スクリプト

### `scripts/openclaw_status_reporter.js` ★ メイン常駐スクリプト

```powershell
$env:OPENCLAW_SECRET = "your-token"
$env:AGENT_ID        = "openclaw-main"   # 省略時: openclaw-main
$env:CURRENT_TASK    = "monitoring"      # 任意
node scripts/openclaw_status_reporter.js
```

```bash
# bash (VPS)
export OPENCLAW_SECRET="your-token"
export AGENT_ID="openclaw-main"
node scripts/openclaw_status_reporter.js
```

- `openclaw models status` を 5 秒ごとに実行 → `Default:` / `usage: N% left` / `Day N% left` をパース
- heartbeat + model_status を同時送信
- Ctrl+C / SIGTERM で `stopped` を送信してから終了

### `scripts/mission_control_heartbeat.js` シンプル heartbeat

```powershell
$env:OPENCLAW_SECRET = "your-token"
$env:AGENT_ID        = "openclaw-main"
node scripts/mission_control_heartbeat.js
```

### `scripts/mission_control_model_status.js` 手動テスト

```powershell
$env:OPENCLAW_SECRET = "your-token"
node scripts/mission_control_model_status.js --model openai-codex --percent 73 --day-percent 45
node scripts/mission_control_model_status.js --model gpt-4o --percent 45 --agent-id discord-bot
```

---

## テスト手順

```powershell
# 1. Next.js 起動
npm run dev -- -p 3001

# 2. openclaw-main を RUNNING に
$env:OPENCLAW_SECRET = "your-token"
$env:AGENT_ID = "openclaw-main"
node scripts/openclaw_status_reporter.js

# → /office でデスクが RUNNING（緑の点滅）になることを確認

# 3. Ctrl+C → 1 秒以内に STOPPED に切り替わることを確認

# 4. discord-bot に heartbeat 送信
$env:AGENT_ID = "discord-bot"
node scripts/mission_control_heartbeat.js

# → /office で discord-bot デスクが現れる

# 5. 15 秒放置 → DOWN（暗い表示）になることを確認
```

---

## セットアップ

```bash
npm install
npx convex dev    # .env.local に NEXT_PUBLIC_CONVEX_URL が自動設定される
```

Convex Dashboard → Settings → Environment Variables:
```
OPENCLAW_SECRET=your-secret-token-here
```

---

## ConoHa VPS デプロイ

```bash
npx convex deploy
npm run build
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

`pm2 stop mission-control` で SIGTERM が送信され、`stopped` が即時反映される。
