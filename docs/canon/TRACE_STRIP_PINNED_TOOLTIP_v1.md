# TRACE_STRIP_PINNED_TOOLTIP v1


Status: CANONICAL  
Owner: Nikita (Maker)  
Scope: Creator Web → Trace Page → Timeline Strip → Pinned Tooltip for Keyboard Scrub  
Version: 1.0.0  
Date: 2026-02-01


## 0) Goal
When selection is moved via keyboard (or click), show a pinned, always-readable tooltip block
(not cursor-following) near the strip:
- line 1: action_type
- line 2: policy_verdict • lifecycle • runner_status
- trace_id
Controls:
- Esc clears selection and hides pinned tooltip (already implemented via selection clear)
Constraints:
- no new API
- deterministic (only from selectedMini)
