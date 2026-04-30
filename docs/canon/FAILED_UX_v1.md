# FAILED_UX v1


Status: CANONICAL  
Owner: Nikita (Maker)  
Scope: Creator Web → Sessions Timeline → Failure Recovery UX  
Version: 1.0.0  
Date: 2026-02-01


## 0) Goal
Make failures actionable:
- understand what changed (diff + trace)
- retry in one click (runnerd)
- surface relogin-required immediately


## 1) UX Contract
### 1.1 Failed Session Card
- Button: Retry (runnerd job)
- Button: Compare vs last OK (diff modal)
- Quick Diff inline (events/duration/relogin + top deltas)


### 1.2 Auto-pin
Sessions with relogin_required hits are pinned above other failed sessions.


### 1.3 Explain Shortcut
Deferred to Step 20 (trace explain page).


## 2) API Contract
### POST /api/creator-web/session/retry
Input:
{ provider_id: string, failed_session_id: string }

Output (ok):
{ ok: true, provider_id, failed_session_id, runner_job_id }

Errors:
- 403 maker_required
- 400 missing_params
- 500 runnerd_job_create_failed / runnerd_unreachable
