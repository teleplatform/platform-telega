# Architecture

This repository is designed to stay readable, predictable, and safe to evolve.
The main rule is simple: **clear boundaries beat cleverness**.

## Goals
- Keep the codebase easy to navigate for humans and agents.
- Make changes reviewable (small, focused, testable).
- Separate concerns: UI, API, domain logic, infrastructure.

## High-level structure
- `docs/` — contracts and decisions (this file, deployment notes, versioning).
- `src/` (or equivalent) — application code.
- `.github/` — CI, templates, repo hygiene.
- `scripts/` — one-off automation or maintenance (if present).

If the repo differs, keep the intent the same: docs + app + automation + CI.

## Core boundaries
### 1) Domain logic (the "brain")
- Pure logic: validation, transformations, rules.
- Should be testable without network or UI.
- Avoid importing framework-specific code here.

### 2) API / server boundary (the "gateway")
- Handles IO: HTTP, auth, storage, external calls.
- Converts requests into domain inputs and returns domain outputs.
- Must not hide business rules inside route handlers.

### 3) UI boundary (the "face")
- Components, pages, rendering, user interactions.
- Calls the API boundary; should not contain hidden business rules.
- Keep components small and composable.

## Data flow
User/UI → API boundary → Domain logic → Storage/External services → back to UI

Keep data contracts explicit and stable:
- Inputs validated at the edge.
- Errors shaped consistently (so UI can render them).

## Conventions
- Prefer small commits with one intent.
- Prefer boring filenames and predictable folders.
- Keep "how to run / deploy / release" in `docs/` (not in tribal knowledge).

## Adding a new feature (definition of done)
- Clear entry point (UI or API).
- Domain logic extracted (if any).
- Basic tests (where meaningful).
- Updated docs if behavior/contract changes.
- CI green.

## Decision log
If a decision changes how contributors should work:
- Update docs in the same commit (or the next immediate one).
