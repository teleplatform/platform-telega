# WEB PROVIDER ADAPTERS v1


Status: CANONICAL
Owner: Nikita (Maker)
Scope: Tele•GPT → browserd → web providers (chatgpt_web, qwen_web, deepseek_web)
Version: 1.0.0
Date: 2026-02-01


## Purpose
Provide stable, compliant web-provider integrations via:
headful manual login → encrypted session vault → headless runs → provider adapters → self-test → trace.


## Non-goals
- No captcha bypass
- No credential harvesting
- No multi-user use
- No scaling/bulk scraping


## Components
- browserd (Playwright worker)
- session vault (encrypted storageState)
- adapters (selectors + DSL steps)
- self-test (detect UI breakage early)
- single-thread queue per provider
- trace jsonl (Maker-only on errors: optional screenshot)


## Reliability Rules
1) One provider = one serialized queue
2) If session invalid → status blocked: re-login required
3) All actions traced (including blocked)
4) Self-test required at startup and on UI errors
