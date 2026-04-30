# GLOBAL_JUMP_RELIABILITY v1

Status: CANONICAL
Owner: Nikita (Maker)
Scope: Creator Web → Trace Page → Global Marker Search → Reliable Jump
Version: 1.0.0
Date: 2026-02-01


## 0) Goal
Make global jump deterministic even when the trace is not in current DOM window:
- seek → render → jump → highlight
- no server/API changes
- local-only, deterministic behavior


## 1) State
- pendingJump: { tid, bin, requestedAt, tries }
- jumpSeeking: boolean
- jumpErr: string | null


## 2) Algorithm
1) User clicks Jump:
   - setActiveBin(bin)
   - set pendingJump(tid, bin)
   - if current trace_id != tid, set traceId to tid (loads window)
2) After render:
   - if DOM has [data-trace-id=tid] → scroll + highlight; clear pendingJump
   - else if traceId != tid → set traceId = tid; increment tries
   - else → set jumpErr = "trace_not_loaded_in_view"


## 3) UX
- show “Seeking…” pill while pending
- show “Jump error” if trace not found in view
