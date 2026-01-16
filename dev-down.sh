#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/.run"

BACK_PID="$RUN_DIR/backend.pid"
UI_PID="$RUN_DIR/ui.pid"

is_pid_running() { local pid="$1"; [[ -n "${pid:-}" ]] && kill -0 "$pid" >/dev/null 2>&1; }

kill_pid() {
  local pid="$1"
  local name="${2:-process}"
  if [[ -n "${pid:-}" ]] && is_pid_running "$pid"; then
    echo "==> Stopping $name (pid $pid) ..."
    kill "$pid" >/dev/null 2>&1 || true
    sleep 0.4
    if is_pid_running "$pid"; then
      echo "==> Hard-killing $name (pid $pid) ..."
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  fi
}

kill_pid_file() {
  local file="$1"
  local name="$2"
  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file" 2>/dev/null || true)"
    kill_pid "$pid" "$name"
    rm -f "$file"
  else
    echo "==> No pid file for $name ($file)"
  fi
}

kill_pid_file "$UI_PID" "UI"
kill_pid_file "$BACK_PID" "Backend"

# На всякий случай добьём портами, если pid-файлы потерялись
kill_port() {
  local port="$1"
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "==> Soft-killing anything listening on :$port"
    kill $(lsof -t -iTCP:"$port" -sTCP:LISTEN) >/dev/null 2>&1 || true
    sleep 0.4

    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "==> Hard-killing anything still listening on :$port"
      kill -9 $(lsof -t -iTCP:"$port" -sTCP:LISTEN) >/dev/null 2>&1 || true
    fi
  fi
}

kill_port 8787

# (5173-5176) — частые порты Vite
for p in 5173 5174 5175 5176; do
  kill_port "$p"
done

echo "✅ Stopped."
