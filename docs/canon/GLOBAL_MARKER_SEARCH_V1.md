# GLOBAL_MARKER_SEARCH v1

Status: CANONICAL
Owner: Nikita (Maker)
Scope: Creator Web → Trace Page → Timeline Strip → Global Marker Search + Jump
Version: 1.0.0
Date: 2026-02-01


## 0) Goal
Global marker search across all bins (localStorage-only), with fast jump:
- search input near bin selector
- results show `[bin] trace_id` + mini label if available
- click result: switch active bin and jump to trace on the strip
- no API, deterministic


## 1) Storage
Reuse Multi-Provider Bins keys:
- mc.bins.v1.index
- mc.bins.v1.active
- mc.bins.v1.markers.<bin_id>


## 2) Rules
- read from localStorage only (browser)
- debounce query (~150ms)
- limit results to a small cap (<=200)
- jump uses data-trace-id anchor + scrollIntoView + transient highlight
