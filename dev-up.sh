#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACK_DIR="$ROOT_DIR"
UI_DIR="$ROOT_DIR/apps/ui"

RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$RUN_DIR" "$LOG_DIR"

BACK_LOG="$LOG_DIR/backend.log"
UI_LOG="$LOG_DIR/ui.log"
BACK_PID="$RUN_DIR/backend.pid"
UI_PID="$RUN_DIR/ui.pid"

echo "==> Preflight: ensure ports are free..."
if lsof -nP -iTCP:8787 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "⚠️  Port 8787 is already in use by:"
  lsof -nP -iTCP:8787 -sTCP:LISTEN
  echo "==> Running dev-down.sh to clean..."
  "$ROOT_DIR/dev-down.sh"
fi

# (5173-5176) — частые порты Vite
for p in 5173 5174 5175 5176; do
  if lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1; then
    echo "⚠️  Port $p is already in use by:"
    lsof -nP -iTCP:$p -sTCP:LISTEN
    echo "==> Running dev-down.sh to clean..."
    "$ROOT_DIR/dev-down.sh"
    break
  fi
done

# --- helpers ---
is_pid_running() { local pid="$1"; [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; }
kill_pid_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && is_pid_running "$pid"; then
      kill "$pid" >/dev/null 2>&1 || true
      # дадим чуть времени закрыться
      sleep 0.4
      if is_pid_running "$pid"; then
        kill -9 "$pid" >/dev/null 2>&1 || true
      fi
    fi
    rm -f "$file"
  fi
}

# --- stop old instances started by these scripts ---
kill_pid_file "$BACK_PID"
kill_pid_file "$UI_PID"

echo "==> Starting Tele•GPT backend (dev) ..."
cd "$BACK_DIR"

# Build / deploy metadata (dev defaults)
if [ -z "${TELEGPT_GIT_SHA:-}" ]; then
  TELEGPT_GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || true)"
  export TELEGPT_GIT_SHA
fi

if [ -z "${TELEGPT_BUILD_ID:-}" ]; then
  TELEGPT_BUILD_ID="dev"
  export TELEGPT_BUILD_ID
fi

echo "[tele-gpt] build=$TELEGPT_BUILD_ID sha=$TELEGPT_GIT_SHA"

# Запускаем backend в фоне (важно: </dev/null чтобы не было 'suspended (tty input)')
nohup sh -c "npm run dev:daemon" </dev/null >>"$BACK_LOG" 2>&1 &
BACK_PID_VAL="$!"
echo "$BACK_PID_VAL" > "$BACK_PID"

# Подождем, пока поднимется порт 8787
for _ in {1..40}; do
  if lsof -nP -iTCP:8787 -sTCP:LISTEN >/dev/null 2>&1; then
    break
  fi
  sleep 0.15
done

if ! lsof -nP -iTCP:8787 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "❌ Backend did not start on :8787. Check log: $BACK_LOG"
  exit 1
fi
echo "✅ Backend up on http://127.0.0.1:8787 (pid $BACK_PID_VAL)"

echo "==> Starting UI (Vite) ..."
cd "$UI_DIR"

# Ставим зависимости если нет node_modules
if [[ ! -d node_modules ]]; then
  echo "==> Installing UI deps ..."
  npm install >>"$UI_LOG" 2>&1
fi

nohup npm run dev </dev/null >>"$UI_LOG" 2>&1 &
UI_PID_VAL="$!"
echo "$UI_PID_VAL" > "$UI_PID"

# Определим реальный порт Vite из лога (5173/5174...)
VITE_PORT=""
for _ in {1..60}; do
  # Ищем "Local:   http://localhost:5173/"
  line="$(grep -Eo 'Local:\s+http://localhost:[0-9]{4}/' "$UI_LOG" | tail -n 1 || true)"
  if [[ -n "$line" ]]; then
    VITE_PORT="$(echo "$line" | grep -Eo '[0-9]{4}' | tail -n 1)"
    break
  fi
  sleep 0.15
done

if [[ -z "$VITE_PORT" ]]; then
  echo "⚠️ UI started (pid $UI_PID_VAL) but port not detected yet."
  echo "   Check log: $UI_LOG"
else
  echo "✅ UI up on http://localhost:${VITE_PORT} (pid $UI_PID_VAL)"
  echo "$VITE_PORT" > "$RUN_DIR/ui.port"
fi

echo
echo "==> Quick checks:"
curl -sS http://127.0.0.1:8787/health && echo
if [[ -n "$VITE_PORT" ]]; then
  curl -sS "http://127.0.0.1:${VITE_PORT}/health" && echo || true
  curl -sS "http://127.0.0.1:${VITE_PORT}/v1/models" && echo || true
fi

echo
echo "==> Runtime:"
echo "  Backend PID: $(cat "$BACK_PID" 2>/dev/null || echo "?")"
echo "  UI PID:      $(cat "$UI_PID" 2>/dev/null || echo "?")"
echo "  UI Port:     $(cat "$RUN_DIR/ui.port" 2>/dev/null || echo "?")"

echo
echo "Logs:"
echo "  tail -f $BACK_LOG"
echo "  tail -f $UI_LOG"
