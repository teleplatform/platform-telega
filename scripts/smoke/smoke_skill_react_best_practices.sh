#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:3000/api}"

CODE_SAMPLE='export function Foo(){return <div>Hello</div>}'

echo "1) AutoReview"
curl -sS -X POST "$BASE/v1/skills/react-best-practices/run" \
  -H "Content-Type: application/json" \
  -d "{\"stage\":\"AutoReview\",\"code\":\"$CODE_SAMPLE\"}" | jq .

echo "2) FixPlan"
curl -sS -X POST "$BASE/v1/skills/react-best-practices/run" \
  -H "Content-Type: application/json" \
  -d "{\"stage\":\"FixPlan\",\"code\":\"$CODE_SAMPLE\"}" | jq .

echo "3) Patch without maker (should fail)"
curl -sS -X POST "$BASE/v1/skills/react-best-practices/run" \
  -H "Content-Type: application/json" \
  -d "{\"stage\":\"Patch\",\"code\":\"$CODE_SAMPLE\"}" | jq .

echo "4) Patch with maker"
curl -sS -X POST "$BASE/v1/skills/react-best-practices/run" \
  -H "Content-Type: application/json" \
  -d "{\"stage\":\"Patch\",\"code\":\"$CODE_SAMPLE\",\"maker_mode\":true}" | jq .

echo "✅ SMOKE SKILL OK"
