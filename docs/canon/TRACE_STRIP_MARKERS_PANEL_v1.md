# TRACE_STRIP_MARKERS_PANEL v1

Status: CANONICAL
Owner: Nikita (Maker)
Scope: Creator Web → Trace Page → Timeline Strip → Markers Panel
Version: 1.0.0
Date: 2026-02-01


## 0) Goal
Add a deterministic “evidence playlist” panel:
- shows all marked trace_ids (local state only)
- each item: action_type + verdict/lifecycle/runner_status (if known)
- actions:
  - click item: select (setSelectedMini)
  - Open: openTrace(trace_id)
  - Unmark: toggleMarker(trace_id)
- Clear all: clearMarkers()
Constraints:
- no new API
- deterministic (markers + neighbors.timeline + already loaded center/selected)
- graceful if a marker isn’t in current neighbors.timeline (show trace_id only)
