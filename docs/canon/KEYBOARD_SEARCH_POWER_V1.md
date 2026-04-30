# KEYBOARD_SEARCH_POWER v1

Status: CANONICAL
Owner: Nikita (Maker)
Scope: Creator Web → Trace Page → Search UX → Keyboard Power
Version: 1.0.0
Date: 2026-02-01


## 0) Goal
Keyboard-first search workflow:
- Cmd/Ctrl+K focuses search input
- Esc clears search + chip focus
- Arrow keys move across pinned/recent chips
- Enter applies focused chip (updates recent)


## 1) Determinism
- no API calls
- uses local state + localStorage only
- roving focus is a pure function of pinned/recent lists
