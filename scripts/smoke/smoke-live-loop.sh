
#!/bin/bash
# Smoke Test: Client Zero Live Loop (Forge ↔ Tele•GPT)

set -e

echo "🧪 Smoke Test: Client Zero Live Loop"
echo "====================================="
echo ""

# Colors
GREEN='[0;32m'
RED='[0;31m'
YELLOW='[1;33m'
NC='[0m' # No Color

# Test 1: Run agent
echo "Test 1: Run agent"
echo "-----------------"

# Owner headers (must be consistent across all tests)
OWNER_HEADERS=(-H "X-Telegram-User-Id: 111")

RESPONSE=$(curl -s -X POST http://localhost:8787/v1/agent/run \
  "${OWNER_HEADERS[@]}" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "task": "Test task for live loop",
      "messages": [
        { "role": "user", "content": "Hello, this is a test" }
      ]
    },
    "options": {
      "model": "openai:gpt-4o-mini",
      "reply_mode": "forge",
      "tools": {
        "fs_read": false,
        "net_fetch": false
      }
    }
  }')

echo "Response: $RESPONSE"

OK=$(echo $RESPONSE | jq -r '.ok')
SID=$(echo $RESPONSE | jq -r '.sid')
STREAM_URL=$(echo $RESPONSE | jq -r '.links.stream')
STATUS_URL=$(echo $RESPONSE | jq -r '.links.status')

if [ "$OK" = "true" ] && [ "$SID" != "null" ]; then
  echo -e "${GREEN}✓ Test 1 PASSED${NC}"
  echo "  SID: $SID"
  echo "  Stream URL: $STREAM_URL"
  echo "  Status URL: $STATUS_URL"
else
  echo -e "${RED}✗ Test 1 FAILED${NC}"
  exit 1
fi

echo ""

# Test 2: Stream events
echo "Test 2: Stream events"
echo "---------------------"
STREAM_OUTPUT=$(curl -s -N \
  "${OWNER_HEADERS[@]}" \
  "http://localhost:8787/v1/agent/stream?sid=$SID" | head -20)

if echo "$STREAM_OUTPUT" | grep -q "event: trace"; then
  echo -e "${GREEN}✓ Test 2 PASSED${NC}"
  echo "  Stream is working"
else
  echo -e "${RED}✗ Test 2 FAILED${NC}"
  exit 1
fi

echo ""

# Test 3: Check trace file
echo "Test 3: Check trace file"
echo "-------------------------"
TRACE_FILE="./evidence/$SID/trace.jsonl"

if [ -f "$TRACE_FILE" ]; then
  echo -e "${GREEN}✓ Test 3 PASSED${NC}"
  echo "  Trace file exists: $TRACE_FILE"
  echo "  Events count: $(wc -l < $TRACE_FILE)"
else
  echo -e "${RED}✗ Test 3 FAILED${NC}"
  exit 1
fi

echo ""

# Test 4: Check required trace events
echo "Test 4: Check required trace events"
echo "-----------------------------------"
REQUIRED_EVENTS=(
  "session.created"
  "session.state_changed"
  "plan.created"
  "step.started"
  "step.finished"
  "evidence.bundle_finalized"
)

ALL_EVENTS_PRESENT=true
for event in "${REQUIRED_EVENTS[@]}"; do
  if ! grep -Fq "\"type\":\"$event\"" "$TRACE_FILE"; then
    echo "✗ Missing event: $event"
    ALL_EVENTS_PRESENT=false
  else
    echo "✓ Found event: $event"
  fi
done

if [ "$ALL_EVENTS_PRESENT" = true ]; then
  echo -e "${GREEN}✓ Test 3 PASSED${NC}"
else
  echo -e "${RED}✗ Test 3 FAILED${NC}"
  exit 1
fi

echo ""

# Test 4: Verify evidence bundle
echo "Test 4: Verify evidence bundle"
echo "-------------------------------"
VERIFY_RESPONSE=$(curl -s -X POST http://localhost:8787/v1/evidence/verify \
  "${OWNER_HEADERS[@]}" \
  -H "Content-Type: application/json" \
  -d "{
    "bundle_ref": "evidence://$SID/bundle"
  }")

echo "Verify Response: $VERIFY_RESPONSE"

VERIFIED=$(echo $VERIFY_RESPONSE | jq -r '.verified')
BUNDLE_HASH=$(echo $VERIFY_RESPONSE | jq -r '.bundle_hash')

if [ "$VERIFIED" = "true" ]; then
  echo -e "${GREEN}✓ Test 4 PASSED${NC}"
  echo "  Bundle verified: true"
  echo "  Bundle hash: $BUNDLE_HASH"
else
  echo -e "${RED}✗ Test 4 FAILED${NC}"
  exit 1
fi

echo ""
# Test 5: Ownership enforcement (foreign subject must be 403)
echo ""
echo "Test 5: Ownership enforcement (foreign subject must be 403)"
echo "-----------------------------------------------------------"

# Foreign headers (OWNER_HEADERS already defined in Test 1)
FOREIGN_HEADERS=(-H "X-Telegram-User-Id: 222")

# Status with foreign subject
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8787${STATUS_URL}" "${FOREIGN_HEADERS[@]}")
if [ "$STATUS_CODE" != "403" ]; then
  echo -e "${RED}✗ Test 5 FAILED${NC}: expected 403 on status, got $STATUS_CODE"
  exit 1
fi
echo "  ✓ Foreign subject gets 403 on status"

# Verify with foreign subject
VERIFY_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "http://localhost:8787/v1/evidence/verify" \
  "${FOREIGN_HEADERS[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"sid\":\"$SID\"}")
if [ "$VERIFY_CODE" != "403" ]; then
  echo -e "${RED}✗ Test 5 FAILED${NC}: expected 403 on verify, got $VERIFY_CODE"
  exit 1
fi
echo "  ✓ Foreign subject gets 403 on verify"

echo -e "${GREEN}✓ Test 5 PASSED${NC}"

# Test 6: Maker override (verify must PASS)
echo ""
echo "Test 6: Maker override (verify must PASS)"
echo "----------------------------------------"

# Maker header (adjust to extractSubject: X-Maker-Role / Authorization / etc.)
MAKER_HEADERS=(-H "X-Maker-Role: 1")

VERIFY_JSON=$(curl -s \
  -X POST "http://localhost:8787/v1/evidence/verify" \
  "${MAKER_HEADERS[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"sid\":\"$SID\"}")

echo "Verify response: $VERIFY_JSON"

echo "$VERIFY_JSON" | grep -q "\"ok\":true" || {
  echo -e "${RED}✗ Test 6 FAILED${NC}: expected ok:true for Maker verify"
  exit 1
}
echo -e "${GREEN}✓ Test 6 PASSED${NC}"

echo ""
# Test B1: Burst / Rate limit (should deny)
echo "[B1] burst should deny (429 or policy.denied/quota_denied)"
DENY=0
for i in $(seq 1 35); do
  CODE=$(curl -s -o /tmp/b1_$i.json -w "%{http_code}" \
    "${OWNER_HEADERS[@]}" \
    -H "Content-Type: application/json" \
    -X POST "http://localhost:8787/v1/agent/run" \
    -d '{"prompt":"ping","stream":false}')
  if [ "$CODE" = "429" ] || grep -q "policy.denied\|quota_denied" /tmp/b1_$i.json; then
    DENY=1
    break
  fi
done
[ "$DENY" = "1" ] || (echo "B1 FAIL: no deny observed" && exit 1)
echo "B1 OK"

echo ""
# Test B2: Steps quota (max_steps=1 → policy.denied)
echo "[B2] max_steps=1 should policy.denied"
curl -s -o /tmp/b2.json \
  "${OWNER_HEADERS[@]}" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:8787/v1/agent/run" \
  -d '{"prompt":"do two steps","stream":false,"debug":{"limits":{"max_steps_per_session":1}}}'
grep -q "policy.denied" /tmp/b2.json || (echo "B2 FAIL" && cat /tmp/b2.json && exit 1)
echo "B2 OK"

echo ""
# Test B3: Tool budget (max_net_fetch_calls=0 → policy.denied)
echo "[B3] max_net_fetch_calls=0 should policy.denied"
curl -s -o /tmp/b3.json \
  "${OWNER_HEADERS[@]}" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:8787/v1/agent/run" \
  -d '{"prompt":"fetch https://example.com","stream":false,"debug":{"limits":{"max_net_fetch_calls_per_session":0}}}'
grep -q "policy.denied" /tmp/b3.json || (echo "B3 FAIL" && cat /tmp/b3.json && exit 1)
echo "B3 OK"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All tests PASSED! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Live loop is working:"
echo "  ✓ Run → Stream → Evidence → Verify"
echo "  ✓ Ownership enforcement (owner/maker only)"
echo "  ✓ Rate limits and quotas (B1/B2/B3)"
echo "  ✓ Client Zero is ready"
