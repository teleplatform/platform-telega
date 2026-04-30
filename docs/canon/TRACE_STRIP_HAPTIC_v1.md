# TRACE_STRIP_HAPTIC v1


Status: CANONICAL  
Owner: Nikita (Maker)  
Scope: Creator Web → Trace Page → Timeline Strip → Haptic Feedback (Mobile)  
Version: 1.0.0  
Date: 2026-02-01


## 0) Goal
Add a tiny deterministic haptic tick when selection changes during scrub:
- mobile-only (coarse pointer)
- uses navigator.vibrate(5)
- rate-limited to avoid buzz spam
Constraints:
- no new API
- deterministic (based only on selection index changes)
- safe: no errors if vibrate unsupported


## 1) Rules
- Only if window.matchMedia('(pointer: coarse)').matches
- Only when index changes
- Rate limit: >= 60ms between vibrations
- Duration: 5ms
