# TRACE_STRIP_MARKERS_PERSIST v1

Status: CANONICAL
Owner: Nikita (Maker)
Scope: Creator Web → Trace Page → Timeline Strip → Persistent Markers
Version: 1.0.0
Date: 2026-02-01


## 0) Goal
Persist local markers between reloads (Maker-only) without server/API:
- storage: localStorage
- key: telegpt.trace.markers.v1:<provider_id>
- format: { [trace_id]: true }


## 1) Rules
- load only in browser (window)
- load on provider_id change
- save on markers change (debounced 150–250ms)
- no server dependency
