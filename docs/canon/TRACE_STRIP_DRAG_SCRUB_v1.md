# TRACE_STRIP_DRAG_SCRUB v1


Status: CANONICAL  
Owner: Nikita (Maker)  
Scope: Creator Web → Trace Page → Timeline Strip → Drag/Tap Scrub  
Version: 1.0.0  
Date: 2026-02-01


## 0) Goal
Deterministic scrub like a video editor:
- Drag (mouse or touch) over strip moves selection across neighbors.timeline
- Release leaves selection (pinned panel stays)
- Double click/tap opens trace (already Step 29)
Constraints:
- no new API
- deterministic (only neighbors.timeline + pointer position)
- no page scroll hijack outside the strip
- ignore while typing in input/textarea/contenteditable


## 1) Rules
- Use strip bounding box to compute relative X position
- Map X → index in [0..timeline.length-1]
- On change: setSelectedMini(timeline[idx]) and setStripTip(null)
- Pointer capture keeps scrub stable during drag
