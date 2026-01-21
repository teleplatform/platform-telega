# Pack Index

## P6 — Task Log (TeleCore BuildTask/BuildResult)
- Stores BuildTask/BuildResult JSON by task_id
- Endpoints for create/result/list/get

## P7 — Heartbeat + Running
- Runner heartbeat endpoint
- Status moves to running (no terminal regression)

## P10 — Summary Counts + Poll Hints
- Counts by status
- Polling hints without extra list calls

## P12 — Local OpenAI-Compatible Provider
- LOCAL_OPENAI_BASE_URL support (vLLM/Ollama/llama.cpp server)
- Creator-only guard for base_url

## CP1 — Creator Provider Guard
- Blocks custom base URLs outside creator mode
- Allows only localhost/127.0.0.1/host.docker.internal

## AP1 — Tele•Ga Agent Patterns v1.0
- Canonical agent law (actions, validation, trace, fallback)
