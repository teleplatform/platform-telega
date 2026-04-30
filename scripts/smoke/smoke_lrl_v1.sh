#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:3000/api}"
USER_ID="${USER_ID:-user_demo}"

echo "1) enqueue order.paid"
OUT=$(curl -sS -X POST "$BASE/v1/lrl/events" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"order.paid\",\"user_id\":\"$USER_ID\",\"payload\":{\"amount\":1000}}")
echo "$OUT" | jq .
EVENT_ID=$(echo "$OUT" | jq -r .event_id)

echo "2) run-once (maker)"
curl -sS -X POST "$BASE/v1/lrl/run-once" \
  -H "Content-Type: application/json" \
  -d "{\"maker_mode\":true}" | jq .

echo "3) wallet"
curl -sS "$BASE/v1/lrl/wallet/$USER_ID" | jq .

echo "4) idempotency (duplicate event)"
HTTP=$(curl -sS -o /tmp/lrl_dup.json -w "%{http_code}" -X POST "$BASE/v1/lrl/events" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$EVENT_ID\",\"type\":\"order.paid\",\"user_id\":\"$USER_ID\",\"payload\":{\"amount\":1000}}")
cat /tmp/lrl_dup.json | jq .
if [ "$HTTP" != "409" ]; then
  echo "Expected 409 but got $HTTP"; exit 1;
fi

echo "5) review gate stars=2"
curl -sS -X POST "$BASE/v1/lrl/events" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"review.left\",\"user_id\":\"$USER_ID\",\"payload\":{\"stars\":2,\"review_id\":\"r1\"}}" | jq .
curl -sS -X POST "$BASE/v1/lrl/run-once" \
  -H "Content-Type: application/json" \
  -d "{\"maker_mode\":true}" | jq .

echo "6) review gate stars=5"
curl -sS -X POST "$BASE/v1/lrl/events" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"review.left\",\"user_id\":\"$USER_ID\",\"payload\":{\"stars\":5,\"review_id\":\"r2\"}}" | jq .
curl -sS -X POST "$BASE/v1/lrl/run-once" \
  -H "Content-Type: application/json" \
  -d "{\"maker_mode\":true}" | jq .

echo "7) traces proof (last 5)"
curl -sS "$BASE/v1/traces?route=/v1/lrl/run-once&limit=5" | jq .

echo "✅ SMOKE LRL OK"
