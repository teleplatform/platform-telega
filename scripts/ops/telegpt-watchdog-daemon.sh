#!/bin/zsh
cd /Users/vijaytaitoo/Projects/tele-gpt
set -a
source .env.dev
set +a

exec npx tsx -e "
import { startWatchdog } from './src/runtime/watchdog/watchdog.runner.js';

console.log('[watchdog] Boot');
startWatchdog();

// Keep alive
await new Promise(() => {});
"