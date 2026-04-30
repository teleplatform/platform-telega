# AUTO_ROOTCAUSE_HINTS v1


Status: CANONICAL  
Owner: Nikita (Maker)  
Scope: Creator Web → Trace Explain Page → Deterministic Root Cause Hints  
Version: 1.0.0  
Date: 2026-02-01


## 0) Goal
Add "Most likely cause" diagnostics to Trace Explain page:
- purely deterministic (no LLM)
- based only on trace fields: policy_verdict, action_type, meta.lifecycle, meta.runner_status, meta.exit_code, meta.reason
- provides 1–2 actionable hints


## 1) Root Cause Classes
- policy_blocked
- relogin_required
- runner_failed
- runner_timeout
- missing_human_interaction (optional if present as meta.reason/lifecycle)
- unknown


## 2) Deterministic Rules (priority order)
1) policy_verdict == "blocked" → policy_blocked  
2) meta.lifecycle == "relogin_required" OR action_type == "relogin_required" → relogin_required  
3) meta.lifecycle == "runner_job_finished" AND meta.runner_status == "failed" → runner_failed  
4) meta.lifecycle == "runner_job_finished" AND meta.runner_status == "timeout" → runner_timeout  
5) else unknown


## 3) Output Contract (UI)
Show block:
- title: "Most likely cause"
- badge: class
- evidence: list of "field=value" used
- hints: 1–2 bullet hints (deterministic)
