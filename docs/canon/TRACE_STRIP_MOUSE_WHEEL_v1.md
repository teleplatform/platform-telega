# TRACE_STRIP_MOUSE_WHEEL v1


Status: CANONICAL  
Owner: Nikita (Maker)  
Scope: Creator Web → Trace Page → Timeline Strip → Mouse Wheel Scrub  
Version: 1.0.0  
Date: 2026-02-01


## 0) Goal
Enable deterministic scrub with mouse wheel over the timeline strip:
- WheelUp = move selection left
- WheelDown = move selection right
- Uses neighbors.timeline only (no new API)
- Does nothing while typing in input/textarea/contenteditable
- Prevent page scroll only when pointer is over the strip


## 1) Rules
- If no selection → start at center_index
- Clamp to [0..timeline.length-1]
- On move: setSelectedMini(next) and setStripTip(null)
- Optional: Shift accelerates by 2 steps (still deterministic)
