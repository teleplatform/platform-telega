#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:3000/api}"

echo "1) Public Image stage"
curl -sS -X POST "$BASE/v1/skills/mediafactory/run" \
  -H "Content-Type: application/json" \
  -d '{"stage":"Image","maker_mode":false,"prompt":"Minimal cover"}' | jq .

echo "2) Public Export (should fail)"
curl -sS -X POST "$BASE/v1/skills/mediafactory/run" \
  -H "Content-Type: application/json" \
  -d '{"stage":"Export","maker_mode":false,"prompt":"Should fail"}' | jq .

echo "3) Maker Export"
curl -sS -X POST "$BASE/v1/skills/mediafactory/run" \
  -H "Content-Type: application/json" \
  -d '{"stage":"Export","maker_mode":true,"prompt":"Maker export","maker":{"duration_sec":8,"fps":30,"with_audio":true}}' | jq .

echo "✅ SMOKE MediaFactory OK"
