#!/bin/bash
# Test complete Telegram → artifact → execution → reply flow

echo "=== Simulating Telegram Message Pipeline ==="
echo "User sends: 'Сделай описание товара: тату машинка Dragonhawk Mast'"
echo ""

ARTIFACT_ID="tg_msg_$(date +%s)_demo"
TASK_ID="tg_task_demo"
TRACE_ID="tg_trace_demo"
USER_MSG="Сделай описание товара: тату машинка Dragonhawk Mast"

echo "Step 1: Register artifact from Telegram message"
REG_RESULT=$(curl -s -X POST http://127.0.0.1:8787/v1/artifacts/dev/register \
  -H "Content-Type: application/json" \
  -d '{
    "artifact": {
      "id": "'"${ARTIFACT_ID}"'",
      "type": "telegram_request",
      "title": "Telegram user request",
      "goal": "Process Telegram message",
      "target": "web_delivery",
      "summary": "'"${USER_MSG}"'",
      "payload": {
        "chat_id": "123456789",
        "user_id": "987654321",
        "text": "'"${USER_MSG}"'"
      }
    },
    "taskId": "'"${TASK_ID}"'",
    "traceId": "'"${TRACE_ID}"'"
  }')

echo "$REG_RESULT"
echo ""

if [ "$(echo "$REG_RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("ok"))')" != "True" ]; then
  echo "❌ Artifact registration failed"
  exit 1
fi

echo "Step 2: Prepare execution"
PREP_RESULT=$(curl -s -X POST http://127.0.0.1:8787/v1/execution/prepare \
  -H "Content-Type: application/json" \
  -d '{
    "artifact_id": "'"${ARTIFACT_ID}"'",
    "traceId": "'"${TRACE_ID}"'",
    "target": "web_delivery"
  }')

echo "$PREP_RESULT"
echo ""

if [ "$(echo "$PREP_RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("allowed"))')" != "True" ]; then
  echo "❌ Execution prepare failed"
  exit 1
fi

echo "Step 3: Run execution"
RUN_RESULT=$(curl -s -X POST http://127.0.0.1:8787/v1/execution/run \
  -H "Content-Type: application/json" \
  -d '{
    "artifact_id": "'"${ARTIFACT_ID}"'",
    "traceId": "'"${TRACE_ID}"'",
    "target": "web_delivery"
  }')

echo "$RUN_RESULT"
echo ""

if [ "$(echo "$RUN_RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("state"))')" != "completed" ]; then
  echo "❌ Execution run failed"
  exit 1
fi

echo "Step 4: Reply to Telegram user"
OUTPUT=$(echo "$RUN_RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("result",{}).get("output","No output"))' 2>/dev/null)
echo "Bot would reply: $OUTPUT"
echo ""

echo "✅ FULL PIPELINE SUCCESS"
echo "   Telegram message → artifact → execution → reply"
