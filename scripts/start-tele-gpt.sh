#!/bin/bash

set -e

cd /Users/vijaytaitoo/Projects/tele-gpt

export PATH="/Users/vijaytaitoo/.nvm/versions/node/v18.20.8/bin:/usr/bin:/bin:/usr/sbin:/sbin"

if [ -f .env.dev ]; then
  set -a
  source .env.dev
  set +a
fi

export TELEGPT_ENABLE_TELEGRAM_BOT="${TELEGPT_ENABLE_TELEGRAM_BOT:-1}"
export TELEGPT_ARTIFACT_BRIDGE_ENABLED="${TELEGPT_ARTIFACT_BRIDGE_ENABLED:-true}"
export TELEGPT_BRIDGE_ENABLED="${TELEGPT_BRIDGE_ENABLED:-true}"
export PANTHEON_TG_POLLING="${PANTHEON_TG_POLLING:-1}"
export TELEGPT_PORT="${TELEGPT_PORT:-8787}"
export NODE_ENV="${NODE_ENV:-production}"
export LOCAL_OPENAI_MODEL_DEFAULT="${LOCAL_OPENAI_MODEL_DEFAULT:-qwen2.5:7b-instruct}"
export LOCAL_OPENAI_BASE_URL="${LOCAL_OPENAI_BASE_URL:-http://127.0.0.1:11434/v1}"
case "$LOCAL_OPENAI_BASE_URL" in
  http://localhost:11434|http://127.0.0.1:11434)
    export LOCAL_OPENAI_BASE_URL="http://127.0.0.1:11434/v1"
    ;;
esac

exec /Users/vijaytaitoo/.nvm/versions/node/v18.20.8/bin/npx tsx src/server/index.ts
