#!/bin/bash
# Creator Bridge Live Validation Test

echo "=== CREATOR BRIDGE LIVE VALIDATION ==="
echo ""

# Set environment
export CREATOR_BRIDGE_ENABLED=1

# Start the server in background
echo "[1] Starting server..."
npm run dev:daemon &
SERVER_PID=$!
sleep 3

# Test 1: Creator OFF - should block
echo ""
echo "[2] TEST 1: Creator OFF (should block)"
curl -s -X POST http://127.0.0.1:8787/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}],"model":"creator:openai:gpt-4o-mini"}' | jq -r '.error.message // .error.type // "unknown"'

# Enable creator mode via bot command simulation
# Note: In real test, you'd enable via /bridge on

# For now, let's test with direct API by passing creatorMode flag
echo ""
echo "[3] TEST 2: Creator ON - GPT path"
curl -s -X POST http://127.0.0.1:8787/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Say CREATOR GPT OK"}],"model":"creator:openai:gpt-4o-mini","creatorMode":true}' | jq -r '.answer[:50] // .error.message // .error.type'

echo ""
echo "[4] TEST 3: Creator ON - Qwen path"  
curl -s -X POST http://127.0.0.1:8787/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Say CREATOR QWEN OK"}],"model":"creator:qwen:qwen-max","creatorMode":true}' | jq -r '.answer[:50] // .error.message // .error.type'

echo ""
echo "[5] TEST 4: Creator ON - DeepSeek path"
curl -s -X POST http://127.0.0.1:8787/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Say CREATOR DEEPSEEK OK"}],"model":"creator:deepseek:deepseek-chat","creatorMode":true}' | jq -r '.answer[:50] // .error.message // .error.type'

# Cleanup
kill $SERVER_PID 2>/dev/null
echo ""
echo "=== TEST COMPLETE ==="