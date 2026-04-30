# SEARCH_RESULT_SELECTION v1

Status: CANONICAL
Owner: Nikita (Maker)
Scope: Creator Web → Trace Page → Search Results → Keyboard Selection
Version: 1.0.0
Date: 2026-02-01


## 0) Goal
Keyboard-first selection in search results:
- ArrowUp/Down moves across results
- Enter: Jump to selected result
- Cmd/Ctrl+Enter: Open selected result
- deterministic, local-only


## 1) Rules
- Results navigation has priority over chip navigation when results exist
- Roving index (resultFocus) clamps to list bounds
- Mouse hover updates active selection
