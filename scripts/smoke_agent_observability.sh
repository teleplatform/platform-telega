#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://localhost:3000/api}"

echo "1) agent ask"
OUT=$(curl -sS -X POST "$BASE/v1/ask" -H "Content-Type: application/json" \
  -d '{"mode":"agent","knowledge_pack_id":"tele_shop_v1","input":"Сколько стоит тату маленькая и когда можно записаться?"}')
echo "$OUT" | jq .

echo "2) assert fields"
echo "$OUT" | jq -e '.intent and .lane and (.fallback_used|type=="boolean") and (.failures_count|type=="number") and (.timeouts|type=="number") and (.max_tokens|type=="number")' >/dev/null
echo "✅ response fields OK"

echo "3) traces proof (last 5)"
curl -sS "$BASE/v1/traces?route=/v1/ask&limit=5" | jq .
echo "✅ SMOKE OK"
