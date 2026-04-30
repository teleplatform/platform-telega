# CREATOR WEB AUTOMATION v1


Status: CANONICAL
Owner: Nikita (Maker)
Scope: Tele•GPT → Providers → Policy → Trace
Version: 1.0.0
Date: 2026-02-01


## Purpose
Vendor-confirmed, compliant automation of official web chat interfaces for
single-user, private/internal personal productivity.


## Provider Class
creator-web-automation:*


Instances (provider_id):
- chatgpt_web (https://chatgpt.com/)
- qwen_web (https://chat.qwen.ai/)
- deepseek_web (https://chat.deepseek.com/)


## Allowed Scope (ALL required)
- account owner only, single-user
- private/internal only
- no public access, no SaaS, no resale, no monetization/ads
- within subscription/credits
- no bypass of safeguards/rate-limits/auth/security
- no scraping/bulk extraction beyond normal user-like interactions
- no impersonation / multi-user simulation
- human-like interaction enforced by policy


## Mandatory Safeguards
- Maker Gate (owner-only access)
- Kill Switch (global off)
- No-Scale Guard (no parallel, no batch)
- Human Interaction Policy (delays + sequencing)
- Audit Trace (every action traceable)


## Relationship to API
API remains recommended for scaling and system-to-system use.
Web automation exists only for personal productivity workflows.
