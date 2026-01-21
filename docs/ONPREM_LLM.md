# On-prem LLM (OpenAI-compatible)

Tele-GPT supports a local provider via an OpenAI-compatible endpoint.

## Env
- `LOCAL_OPENAI_BASE_URL` (e.g. http://127.0.0.1:8000/v1)
- `LOCAL_OPENAI_MODEL` (e.g. Qwen/Qwen3-4B-Instruct-2507)

## Provider selection (canonical)
- If `OPENAI_API_KEY` is set → use OpenAI provider
- Else if `LOCAL_OPENAI_BASE_URL` is set → use Local provider
- Else → local-demo fallback
