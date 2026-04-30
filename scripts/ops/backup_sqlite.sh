#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${TELEGPT_DATA_DIR:-.data}"
DB_PATH="$DATA_DIR/tele-gpt.sqlite"
OUT_DIR="${OUT_DIR:-backups}"

if [ ! -f "$DB_PATH" ]; then
  echo "DB not found: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
TS=$(date +"%Y%m%d_%H%M%S")
cp "$DB_PATH" "$OUT_DIR/tele-gpt.sqlite.$TS.bak"
echo "Backup created: $OUT_DIR/tele-gpt.sqlite.$TS.bak"
