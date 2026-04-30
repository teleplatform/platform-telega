# SEARCH_QUERY_HINTS v1

Status: CANONICAL
Owner: Nikita (Maker)
Scope: Creator Web → Trace Page → Search UX → Query Hints
Version: 1.0.0
Date: 2026-02-01


## 0) Goal
Provide deterministic hint chips based on current visible timeline:
- only when searchMode=visible and searchQuery is empty
- frequency-ranked hints
- click hint → applySearch


## 1) Source
- neighbors.timeline (action_type, policy_verdict, lifecycle, runner_status)


## 2) Ranking
- frequency desc
- alpha tie-break
- cap <= 10


## 3) Determinism
- local-only
- no API
