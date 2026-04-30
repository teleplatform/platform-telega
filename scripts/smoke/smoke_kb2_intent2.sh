#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:3000/api}"
KEY="${KEY:-tele_shop_v1}"

echo "1) PUT create KB entry"
curl -sS -X PUT "$BASE/v1/kb/$KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload_json":{"id":"tele_shop_v1","version":"1.0.1","brand_terms":["Tele•Ga"]}}' | jq .

echo "2) GET KB entry"
ETAG=$(curl -sS "$BASE/v1/kb/$KEY" | jq -r .etag)
echo "ETAG=$ETAG"

echo "3) PUT with wrong etag -> 409"
HTTP=$(curl -sS -o /tmp/kb_out.json -w "%{http_code}" -X PUT "$BASE/v1/kb/$KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload_json":{"id":"tele_shop_v1","version":"1.0.2"},"if_match_etag":"wrong"}')
cat /tmp/kb_out.json | jq .
if [ "$HTTP" != "409" ]; then
  echo "Expected 409 but got $HTTP"; exit 1;
fi

echo "4) intent smoke (force LLM with threshold 0.99 if set)"
OUT=$(curl -sS -X POST "$BASE/v1/ask" -H "Content-Type: application/json" \
  -d '{"mode":"agent","knowledge_pack_id":"tele_shop_v1","input":"Расскажи про Tele•Ga"}')
echo "$OUT" | jq .

echo "✅ SMOKE KB-2 + INTENT-2 OK"
