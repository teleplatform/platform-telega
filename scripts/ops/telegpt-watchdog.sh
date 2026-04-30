#!/bin/zsh
cd /Users/vijaytaitoo/Projects/tele-gpt && set -a && source .env.dev && set +a && npx tsx src/server/index.ts --watchdog