# TRACE_STRIP_KEYBOARD v1


Status: CANONICAL  
Owner: Nikita (Maker)  
Scope: Creator Web → Trace Page → Timeline Strip → Keyboard Scrub  
Version: 1.0.0  
Date: 2026-02-01


## 0) Goal
Keyboard control for timeline strip (deterministic):
- ArrowLeft / ArrowRight: move selection across neighbors.timeline
- Enter: open selected trace_id
- Escape: clear selection + tooltip
Constraints:
- no new API
- ignore when typing in input/textarea/contenteditable
