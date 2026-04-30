# SEARCH_PRESETS v1


Status: CANONICAL
Owner: Nikita (Maker)
Scope: Creator Web → Trace Page → Search Presets
Version: 1.0.0
Date: 2026-02-01


## 0) Goal
Named snapshots of search state:
- {name, query, mode}
- localStorage-only
- deterministic, no API


## 1) Storage
- Key: `mc.search.v1.presets`
- Value: `SearchPreset[]`
- Cap: 10

```
type SearchPreset = {
  name: string;
  query: string;
  mode: "marked" | "visible";
};
```


## 2) Rules
- Save preset uses current `searchQuery` (trimmed + truncated).
- Name is prompted and trimmed to 32 chars.
- Dedup by `{name, query, mode}` (case-insensitive).
- Apply preset sets mode and applies search.
- Remove preset deletes entry.


## 3) UX
- Button: “💾 Save preset”
- Preset chips: click = apply, ✕ = remove


## 4) Determinism
- localStorage-only
- no server calls
