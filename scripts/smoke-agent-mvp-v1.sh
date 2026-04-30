
#!/bin/bash
# Smoke Test for Agent Runtime MVP v1

set -e

echo "🧪 Smoke Test: Agent Runtime MVP v1"
echo "=================================="
echo ""

# Colors
GREEN='[0;32m'
RED='[0;31m'
YELLOW='[1;33m'
NC='[0m' # No Color

# Test 1: No tools
echo "Test 1: No tools"
echo "----------------"
RESPONSE=$(curl -s -X POST http://localhost:8787/v1/agent/run   -H "Content-Type: application/json"   -d '{
    "input": {
      "messages": [
        { "role": "user", "content": "Hello, how are you?" }
      ]
    },
    "options": {
      "model": "openai:gpt-4o-mini",
      "tools": {
        "fs_read": false,
        "net_fetch": false
      }
    }
  }')

echo "Response: $RESPONSE"

OK=$(echo $RESPONSE | jq -r '.ok')
SID=$(echo $RESPONSE | jq -r '.sid')
STATUS=$(echo $RESPONSE | jq -r '.status')

if [ "$OK" = "true" ] && [ "$STATUS" = "completed" ]; then
  echo -e "${GREEN}✓ Test 1 PASSED${NC}"
else
  echo -e "${RED}✗ Test 1 FAILED${NC}"
  exit 1
fi

echo ""

# Test 2: Verify evidence bundle
echo "Test 2: Verify evidence bundle"
echo "--------------------------------"
BUNDLE_REF=$(echo $RESPONSE | jq -r '.evidence.bundle_ref')
VERIFY_RESPONSE=$(curl -s -X POST http://localhost:8787/v1/evidence/verify   -H "Content-Type: application/json"   -d "{
    "bundle_ref": "$BUNDLE_REF"
  }")

echo "Verify Response: $VERIFY_RESPONSE"

VERIFIED=$(echo $VERIFY_RESPONSE | jq -r '.verified')

if [ "$VERIFIED" = "true" ]; then
  echo -e "${GREEN}✓ Test 2 PASSED${NC}"
else
  echo -e "${RED}✗ Test 2 FAILED${NC}"
  exit 1
fi

echo ""

# Test 3: Stream trace events
echo "Test 3: Stream trace events"
echo "----------------------------"
STREAM_OUTPUT=$(curl -s -N http://localhost:8787/v1/agent/stream?sid=$SID | head -20)

if echo "$STREAM_OUTPUT" | grep -q "event: trace"; then
  echo -e "${GREEN}✓ Test 3 PASSED${NC}"
else
  echo -e "${RED}✗ Test 3 FAILED${NC}"
  exit 1
fi

echo ""

# Test 4: Check trace file exists
echo "Test 4: Check trace file exists"
echo "--------------------------------"
TRACE_FILE="./evidence/$SID/trace.jsonl"

if [ -f "$TRACE_FILE" ]; then
  echo -e "${GREEN}✓ Test 4 PASSED${NC}"
else
  echo -e "${RED}✗ Test 4 FAILED${NC}"
  exit 1
fi

echo ""

# Test 5: Check required trace events
echo "Test 5: Check required trace events"
echo "------------------------------------"
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
  if grep -q ""type":"$event"" "$TRACE_FILE"; then
    echo "✓ Found event: $event"
  else
    echo "✗ Missing event: $event"
    ALL_EVENTS_PRESENT=false
  fi
done

if [ "$ALL_EVENTS_PRESENT" = true ]; then
  echo -e "${GREEN}✓ Test 5 PASSED${NC}"
else
  echo -e "${RED}✗ Test 5 FAILED${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All tests PASSED! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
