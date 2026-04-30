# TRACE_STRIP_SHIFT_ACCEL v1


Status: CANONICAL  
Owner: Nikita (Maker)  
Scope: Creator Web → Trace Page → Timeline Strip → Keyboard Shift Acceleration  
Version: 1.0.0  
Date: 2026-02-01


## 0) Goal
Deterministic acceleration for keyboard scrub:
- Shift+←/→ = move by 2
- Shift+J/L = move by 2
- (no change for K=center, Enter=open, Esc=clear)
Constraints:
- no new API
- ignore when typing in input/textarea/contenteditable
- uses neighbors.timeline only
