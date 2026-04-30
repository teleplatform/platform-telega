# TRACE_STRIP_TOOLTIPS v1


Status: CANONICAL  
Owner: Nikita (Maker)  
Scope: Creator Web → Trace Page → Timeline Strip → Hover Tooltip  
Version: 1.0.0  
Date: 2026-02-01


## 0) Goal
Replace native title tooltips with a deterministic hover-tooltip block:
- shows 2 lines:
  1) action_type
  2) verdict / lifecycle / runner_status
- appears on dot hover, disappears on mouse leave
- positioned near cursor (fixed), no dependencies, no API
