# TRACE_NEIGHBOR_NAV v1


Status: CANONICAL  
Owner: Nikita (Maker)  
Scope: Creator Web → Trace Page → Neighbor Navigation (Prev/Next)  
Version: 1.0.0  
Date: 2026-02-01


## 0) Goal
Add deterministic navigation on trace page:
- Prev / Next trace for the same provider_id
- based on time ordering (ts) within a bounded tail window of the jsonl trace file


## 1) Inputs
- trace_id (center)


## 2) Deterministic algorithm
1) Read tail bytes of creator-web-trace.jsonl  
2) Parse rows, find center row by trace_id (or id)  
3) Filter rows with same provider_id  
4) Sort by ts ascending (ts derived from row.ts or created_at)  
5) Pick previous and next relative to the center index  
6) Return prev/next trace_id + ts  


## 3) API
GET /api/creator-web/trace/neighbors?trace_id=...&bytes=...&limit=...  
Maker-only.

Output:
{ ok: true, center: {...}, prev: {...}|null, next: {...}|null, window: {...} }


## 4) UX
On Trace Page show:
- “Prev” button (disabled if none)  
- “Next” button (disabled if none)  
- small pills with ts/provider_id for context
