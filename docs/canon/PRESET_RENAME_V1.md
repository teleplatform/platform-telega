# PRESET_RENAME v1


Status: CANONICAL
Owner: Nikita (Maker)
Scope: Creator Web → Trace Page → Search Presets → Rename
Version: 1.0.0
Date: 2026-02-01


## 0) Goal
Rename a preset in place (no delete/recreate).
Local-only, deterministic, cap 10.


## 1) Rules
- Prompt with current name.
- Trim to 32 chars.
- Empty input → no-op.
- Duplicate {name, query, mode} (case-insensitive) → no-op.
- Query/mode remain unchanged.


## 2) UX
- ✎ button next to each preset chip.


## 3) Determinism
- localStorage-only
- no API
