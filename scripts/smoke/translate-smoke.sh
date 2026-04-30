#!/usr/bin/env bash
set -euo pipefail

curl -s http://127.0.0.1:8787/translate \
  -H "Content-Type: application/json" \
  -d '{"sourceText":"Привет! Как дела?","mode":"public"}' | cat
echo

curl -s http://127.0.0.1:8787/translate \
  -H "Content-Type: application/json" \
  -d '{"sourceText":"Запусти npm install в директории /home/user/project","mode":"public"}' | cat
echo

curl -s http://127.0.0.1:8787/translate \
  -H "Content-Type: application/json" \
  -d '{"sourceText":"Ошибка в файле src/index.ts на строке 42","mode":"public"}' | cat
echo
