# SEARCH_MODE_TOGGLE v1

Status: CANONICAL
Owner: Nikita (Maker)
Scope: Creator Web → Trace Page → Search UX → Mode Toggle
Version: 1.0.0
Date: 2026-02-01


## 0) Goal
Toggle search scope:
- Marked only (current behavior)
- All visible traces (current strip window)


## 1) Determinism
- local-only, no API
- "All visible" uses neighbors.timeline


## 2) UX
- toggle button near search input
- preserves query and results reactively
