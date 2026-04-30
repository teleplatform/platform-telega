# RESULT_DEDUPE_AND_RANK v1

Status: CANONICAL
Owner: Nikita (Maker)
Scope: Creator Web → Trace Page → Search Results → Dedupe & Rank
Version: 1.0.0
Date: 2026-02-01


## 0) Goal
Deterministic result deduplication and ordering:
- remove duplicates (by tid, or by bin+tid for marked mode)
- rank by match quality, then proximity (visible mode), then recency


## 1) Match Order
1) exact match
2) prefix match
3) includes
4) other (unused by default because non-matches are filtered out)


## 2) Dedupe
- visible mode: key = tid
- marked mode: key = bin:tid


## 3) Ordering
- matchType (exact → prefix → includes)
- distance to center (visible only)
- ts descending (if available)


## 4) Limits
- cap results to 200
