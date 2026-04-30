# RECENT_SEARCHES_PINNED_QUERIES v1

Status: CANONICAL
Owner: Nikita (Maker)
Scope: Creator Web → Trace Page → Search UX → Recent & Pinned Queries
Version: 1.0.0
Date: 2026-02-01


## 0) Goal
Speed up search like in an NLE:
- Recent searches (LRU, click to apply)
- Pinned queries (always visible)
- localStorage-only, deterministic


## 1) Storage Keys
- mc.search.v1.recent → string[] (cap 10)
- mc.search.v1.pinned → string[] (cap 10)


## 2) Rules
- normalize: trim, ignore empty
- dedupe case-insensitive; keep original text
- recents update only on “confirm” actions (Enter, Jump/Open, click recent/pinned)
- pinned separate from recent


## 3) UX
- search input + ⭐ Pin
- Pinned chips + Recent chips with ✕ remove
