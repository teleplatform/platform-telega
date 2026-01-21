# Conventional Commits

We use a lightweight Conventional Commits format to keep history readable and automate releases.

## Format
<type>(optional scope): <subject>

Examples:
- feat: add product import
- fix: handle empty payload
- docs: update deployment notes
- ci: harden codeql permissions
- chore(deps): bump dependency group

## Allowed types
- feat: new functionality (user-visible)
- fix: bug fixes
- docs: documentation only
- ci: CI/workflows changes
- chore: maintenance, tooling, refactors without behavior change
- refactor: refactoring that does not change behavior
- test: tests only
- build: build system changes (deps, bundling)
- perf: performance improvements

## Rules
- Subject is lowercase, imperative, no trailing period.
- Keep commits small and single-purpose.
- Prefer squash merge (see PR policy).

## Breaking changes
Use `!` to mark breaking changes:
- feat!: change API contract

Or include `BREAKING CHANGE:` in the body.
