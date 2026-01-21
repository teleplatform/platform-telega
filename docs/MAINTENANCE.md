# Maintenance

This document captures lightweight, repeatable maintenance routines.

## Dependabot PRs
- Prefer merging grouped updates when checks are green.
- If an update breaks builds, comment with the failure and close or re-run after fixes.
- Avoid pinning versions unless required for stability.

## Broken CI
1) Check the failing workflow logs.
2) Re-run the job if it appears transient.
3) If reproducible:
   - Fix or revert in a small PR.
   - Update `CHANGELOG.md` if behavior changes.

## Deprecations
- Track deprecation warnings from dependencies.
- Prefer smaller, frequent upgrades over large jumps.

## Releases
- Follow `docs/RELEASE.md`.
- Ensure `CHANGELOG.md` is updated before tagging.
