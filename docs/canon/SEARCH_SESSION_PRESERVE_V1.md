# SEARCH_SESSION_PRESERVE v1

Status: CANONICAL
Owner: Nikita (Maker)
Scope: Creator Web → Trace Page → Search UX → Session Preserve
Version: 1.0.0
Date: 2026-02-01


## 0) Goal
Preserve search context across reloads (localStorage-only):
- searchQuery
- searchMode


## 1) Storage Keys
- mc.search.v1.last.query
- mc.search.v1.last.mode


## 2) Restore
- browser-only on mount
- mode validated: only "marked" | "visible"
- query normalized via truncateQuery


## 3) Save
- debounced (200ms)
- clear query key when empty


## 4) Determinism
- no API
- local-only
