# TRACE_STRIP_JKL v1


Status: CANONICAL  
Owner: Nikita (Maker)  
Scope: Creator Web → Trace Page → Timeline Strip → Keyboard J/K/L  
Version: 1.0.0  
Date: 2026-02-01


## 0) Goal
Add video-editor style keys (deterministic):
- J = move selection left
- L = move selection right
- K = jump selection to center_index
- Enter = open selected trace
- Esc = clear selection + tooltip
Constraints:
- no new API
- ignore when typing in input/textarea/contenteditable
- use neighbors.timeline only
