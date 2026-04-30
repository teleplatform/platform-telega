# TRACE_STRIP_OPEN_ON_DOUBLECLICK v1


Status: CANONICAL  
Owner: Nikita (Maker)  
Scope: Creator Web → Trace Page → Timeline Strip → DoubleClick Open  
Version: 1.0.0  
Date: 2026-02-01


## 0) Goal
Make strip interaction cinematic but deterministic:
- Single click on dot: select (shows delta/pinned panel)
- Double click on dot: openTrace(trace_id)
- Ctrl/Meta+click: openTrace(trace_id) (kept)
Constraints:
- no new API
- deterministic (pure UI behavior)
- does not break tooltip behavior
