# Release Process

This repository follows **Semantic Versioning**: `MAJOR.MINOR.PATCH`.

## When to release
Create a release when:
- a user-visible feature ships,
- a bug fix is important enough to publish,
- behavior/contracts changed (API/CLI/public output),
- dependency or security updates must be delivered.

## Pre-release checklist
1) Pull latest `main`:
   - `git pull origin main`
2) Ensure CI is green (locally and on GitHub).
3) Update `CHANGELOG.md`:
   - Move entries from `[Unreleased]` into a new version section:
     - `## [X.Y.Z] - YYYY-MM-DD`
4) Bump version:
   - If `package.json` exists: update its version.
   - Otherwise keep versioning via tags only.

## Tagging rules
- Tags must be annotated: `vX.Y.Z`
- Example: `v0.1.0`

## Create a release tag (canonical)
```bash
git tag -a vX.Y.Z -m "release: vX.Y.Z"
git push origin vX.Y.Z
```

## Post-release
- Verify GitHub Actions finished successfully.
- Ensure the changelog matches the released tag.
- If needed, create a GitHub Release using the tag and paste changelog notes.

## Release notes discipline
- Prefer GitHub auto-generated release notes (grouped by labels).
- Ensure PRs have correct labels (docs/ci/deps/feature/bug).
- For notable changes, add a short PR summary so release notes read well.

## Hotfixes
- Patch bump only: X.Y.(Z+1)
- Keep changes minimal and reviewable.
