# WEB SESSION LIFECYCLE v1


Status: CANONICAL
Owner: Nikita (Maker)
Scope: Creator Web Providers (chatgpt_web / qwen_web / deepseek_web)
Version: 1.0.0
Date: 2026-02-01


## Goal
Make session expiry a first-class, traceable, user-visible state:
- Detect "login required" deterministically
- Persist relogin_required per provider
- Show it in UI + manual relogin path
- Never attempt captcha/security bypass


## States
Provider status:
- normal
- slow
- paused
- blocked


Blocked reasons (meta):
- relogin_required (session expired / login redirect)
- kill_switch
- provider_disabled
- policy_blocked


## Detection rules
A provider is relogin_required if any happens:
1) Healthcheck sees login page hint or missing input
2) runChat sees login page hint / redirect / missing input
3) adapter returns error = "login_required"


## Actions
- If relogin_required → set provider status = blocked, persist meta:
  relogin_required=true, relogin_reason, relogin_at
- UI shows:
  - badge: "Re-login required"
  - button: "Re-login" (opens provider source_url in new tab)
  - optional hint text: "Login manually; then re-run health"


## Forbidden
- Storing raw passwords
- Automated bypass of captcha / security
- Multi-user / shared sessions
