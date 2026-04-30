#!/usr/bin/env bash
set -euo pipefail

PROFILE_DIR="${HOME}/.telegpt/chrome-profiles/openai-creator"
EXT_DIR="/Users/vijaytaitoo/Projects/tele-gpt/telegpt-extension"

echo ""
echo "🧩 OpenAI Extension Smoke"
echo "========================="
echo ""

mkdir -p "$PROFILE_DIR"

echo "1) Closing Chrome..."
pkill -f "Google Chrome" >/dev/null 2>&1 || true
sleep 1

echo "2) Starting clean Chrome WITHOUT remote debugging..."
open -na "Google Chrome" --args \
  --user-data-dir="$PROFILE_DIR"

echo ""
echo "Chrome started."
echo ""
echo "Next exact steps:"
echo "  1. Open chrome://extensions"
echo "  2. Enable Developer mode"
echo "  3. Click 'Load unpacked'"
echo "  4. Select: $EXT_DIR"
echo "  5. Open https://chatgpt.com"
echo "  6. Complete manual login"
echo "  7. Open DevTools Console on chatgpt.com"
echo ""
echo "Run test:"
echo ""
echo "Success criteria:"
echo "  PING  -> ok:true"
echo "  STATE -> ready:true"
echo "  SEND  -> ok:true"
echo ""