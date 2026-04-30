# TRACE_DELTA_PAIR v1


Status: CANONICAL  
Owner: Nikita (Maker)  
Scope: Creator Web → Trace Page → Timeline Strip → Delta vs Center Panel  
Version: 1.0.0  
Date: 2026-02-01


## 0) Goal
When user clicks a dot in timeline strip, show a mini panel:
"Delta vs center" — what changed (deterministic), based only on:
- policy_verdict
- lifecycle
- runner_status

Show at most 2 deltas (priority order):
1) policy_verdict  
2) lifecycle  
3) runner_status  

If no changes → show "(no changes)".
