# TRACE_STRIP_SPACE_TOGGLE v1


Status: CANONICAL  
Owner: Nikita (Maker)  
Scope: Creator Web → Trace Page → Timeline Strip → Space Open/Clear  
Version: 1.0.0  
Date: 2026-02-01


## 0) Goal
Deterministic “video editor” space controls:
- Space = Open selected trace (same as Enter)
- Shift+Space = Clear selection + tooltip (same as Esc)
Constraints:
- no new API
- ignore when typing in input/textarea/contenteditable
- uses neighbors.timeline only
