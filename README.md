# tele-gpt

HTTP service.

## Quick start

```bash
npm install
cp .env.example .env.dev
npm run dev
```

`npm run dev` читает `.env.dev`.

Minimum required env: `PORT` (или `TELEGPT_PORT`) + один провайдер: `OPENAI_API_KEY` либо `LOCAL_OPENAI_BASE_URL` (и `LOCAL_OPENAI_MODEL`).

Health check (если меняли `PORT` — подставьте свой):
```bash
curl http://localhost:8787/health
```

## Dev

All commands assume you are in the repo root:

```bash
cd ~/Projects/tele-gpt
bash dev-up.sh
```

Dev notes: see CONTRIBUTING.md
Deploy notes: see DEPLOYMENT.md
