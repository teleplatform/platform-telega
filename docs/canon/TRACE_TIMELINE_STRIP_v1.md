# TRACE_TIMELINE_STRIP v1


Status: CANONICAL  
Owner: Nikita (Maker)  
Scope: Creator Web → Trace Page → Mini Timeline Strip (scrub)  
Version: 1.0.0  
Date: 2026-02-01


## 0) Goal
Show a deterministic mini-timeline (≈7 points):  
prev3 + center + next3 (same provider_id, ordered by ts).  
Clickable points open the trace_id.


## 1) Data source
Reuse neighbors endpoint:  
GET /api/creator-web/trace/neighbors?trace_id=...

Extend output:
- timeline: Mini[] (bounded window around center)
- center_index: number


## 2) Point classification (deterministic)
Given Mini row:
- if policy_verdict == "blocked" → class=blocked (bad)
- else if lifecycle == "relogin_required" → class=relogin (warn)
- else if lifecycle == "runner_job_finished" and runner_status == "failed" → class=runner_failed (bad)
- else if lifecycle == "runner_job_finished" and runner_status == "timeout" → class=runner_timeout (warn)
- else class=ok (neutral)


## 3) UX
- horizontal strip of 7 dots
- center dot larger + ring
- tooltip/pills show action_type + verdict/lifecycle
- click dot → openTrace(trace_id)
