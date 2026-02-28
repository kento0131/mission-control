#!/usr/bin/env bash
set -euo pipefail

CONVEX_SITE_URL="${CONVEX_SITE_URL:-https://opulent-clam-873.convex.site}"
AGENT_ID="${AGENT_ID:-openclaw-main}"
INTERVAL_SEC="${INTERVAL_SEC:-15}"
OPENCLAW_CMD="${OPENCLAW_CMD:-/root/.nvm/versions/node/v22.22.0/bin/openclaw}"

if [[ -z "${OPENCLAW_SECRET:-}" ]]; then
  echo "OPENCLAW_SECRET is required" >&2
  exit 1
fi

while true; do
  ERR_FILE=$(mktemp)
  RAW="$(script -q -c "$OPENCLAW_CMD models status" /dev/null 2>"$ERR_FILE" || true)"
  ERR_MSG=$(cat "$ERR_FILE" || true)
  rm -f "$ERR_FILE"
  RAW=$(printf '%s' "$RAW" | tr -d '\r')
  CLEAN=$(printf '%s' "$RAW" | sed -E 's/\x1B\[[0-9;]*[A-Za-z]//g')

  MODEL=$(printf '%s\n' "$CLEAN" | sed -n 's/^Default[[:space:]]*:[[:space:]]*//p' | head -n1)
  [[ -z "$MODEL" ]] && MODEL="openai-codex/gpt-5.3-codex"

  REMAIN=$(printf '%s\n' "$CLEAN" | sed -n 's/.*usage:.* \([0-9][0-9]*\)%[[:space:]]*left.*/\1/p' | head -n1)
  DAY=$(printf '%s\n' "$CLEAN" | sed -n 's/.*Day[[:space:]]*\([0-9][0-9]*\)%[[:space:]]*left.*/\1/p' | head -n1)

  if [[ -n "$REMAIN" ]]; then
    if [[ -n "$DAY" ]]; then
      BODY=$(printf '{"agent_id":"%s","model":"%s","remaining_percent":%s,"remaining_day_percent":%s,"raw":%s}' \
        "$AGENT_ID" "$MODEL" "$REMAIN" "$DAY" "$(printf '%s' "$RAW" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")
    else
      BODY=$(printf '{"agent_id":"%s","model":"%s","remaining_percent":%s,"raw":%s}' \
        "$AGENT_ID" "$MODEL" "$REMAIN" "$(printf '%s' "$RAW" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")
    fi

    curl -sS -X POST "$CONVEX_SITE_URL/api/openclaw/model_status" \
      -H "Authorization: Bearer $OPENCLAW_SECRET" \
      -H "Content-Type: application/json" \
      -d "$BODY" >/dev/null || true

    echo "[$(date -Iseconds)] model_status updated: ${MODEL} remain=${REMAIN}% day=${DAY:-N/A}%"
  else
    echo "[$(date -Iseconds)] model_status parse failed len=${#RAW} err=${ERR_MSG:-none}"
  fi

  sleep "$INTERVAL_SEC"
done
