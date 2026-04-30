#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:3000/api}"

echo "1) health"
curl -sS "$BASE/v1/health" | jq .

echo "2) create task (queued)"
TASK_ID=$(curl -sS -X POST "$BASE/v1/tasks" -H "Content-Type: application/json" -d '{}' | jq -r .id)
echo "TASK_ID=$TASK_ID"

echo "3) queued -> running (CAS)"
VER=$(curl -sS "$BASE/v1/tasks/$TASK_ID" | jq -r .version)
curl -sS -X PATCH "$BASE/v1/tasks/$TASK_ID/status" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"running\",\"expected_version\":$VER}" | jq .

echo "4) heartbeat ping"
curl -sS -X POST "$BASE/v1/tasks/$TASK_ID/heartbeat" | jq .

echo "5) sweep should NOT block fresh running"
curl -sS -X POST "$BASE/v1/tasks/sweep" | jq .

echo "6) simulate stale heartbeat (dev-only patch)"
curl -sS -X POST "$BASE/v1/tasks/$TASK_ID/dev-set-heartbeat-stale" | jq .

echo "7) sweep SHOULD block stale running"
curl -sS -X POST "$BASE/v1/tasks/sweep" | jq .

echo "8) 409 proof: try to change terminal status"
VER2=$(curl -sS "$BASE/v1/tasks/$TASK_ID" | jq -r .version)
HTTP=$(curl -sS -o /tmp/out.json -w "%{http_code}" -X PATCH "$BASE/v1/tasks/$TASK_ID/status" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"done\",\"expected_version\":$VER2}")
cat /tmp/out.json | jq .
if [ "$HTTP" != "409" ]; then
  echo "Expected 409 but got $HTTP"; exit 1;
fi
echo "✅ 409 proof OK"

echo "9) traces proof"
curl -sS "$BASE/v1/traces?route=/v1/tasks/sweep&limit=5" | jq .

echo "✅ SMOKE OK"
