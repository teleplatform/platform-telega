# TRACE_STRIP_MARKERS v1


Status: CANONICAL  
Owner: Nikita (Maker)  
Scope: Creator Web → Trace Page → Timeline Strip → Local Markers  
Version: 1.0.0  
Date: 2026-02-01


## 0) Goal
Deterministic “evidence markers”:
- M: toggle marker on selected trace_id
- Shift+M: clear all markers
- Markers are local UI state only (no API)
UX:
- Marked dots show an extra ring (or small badge)
- Pinned “Selected” panel shows marker state
Constraints:
- no new API
- ignore when typing in input/textarea/contenteditable
- uses neighbors.timeline only
