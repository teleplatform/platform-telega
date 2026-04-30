# MULTI_PROVIDER_BINS v1

Status: CANONICAL
Owner: Nikita (Maker)
Scope: Creator Web → Trace Page → Timeline Strip → Multi-Provider Bins (localStorage)
Version: 1.0.0
Date: 2026-02-01


## 0) Goal
NLE-style “Bins/Media Pools” for markers:
- one active bin at a time
- bins are localStorage-only (no server)
- deterministic, no auto-merge


## 1) Storage Keys
- index: mc.bins.v1.index (array of bin ids)
- active: mc.bins.v1.active (string)
- markers per bin: mc.bins.v1.markers.<bin_id> (object: { [trace_id]: true })


## 2) Rules
- bin id is normalized (lowercase, safe chars)
- provider_id is the default bin
- load on bin change, save on markers change (debounced)
- no API dependency
