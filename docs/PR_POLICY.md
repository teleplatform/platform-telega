# PR Policy

This repo uses a simple rule: **no green checks, no merge**.

## Branch protection (GitHub settings)
Apply these rules to `main`:

- Require a pull request before merging
- Require approvals: 1
- Dismiss stale approvals when new commits are pushed
- Require conversation resolution before merging
- Require status checks to pass before merging:
  - `ci`
  - `security`
  - `commitlint`
- Require branches to be up to date before merging
- Restrict force pushes (recommended)
- Restrict deletions (recommended)

## Merge strategy
- Preferred: **Squash merge**
- PR title should be meaningful (it becomes the squash commit message)
- Keep PRs small and focused (one intent)

## What every PR must include
- A clear summary of what changes and why
- Evidence it works:
  - CI passes
  - Security workflow passes
  - Local build (`npm run build`) if applicable
- Docs updated if behavior/contracts changed

## Dependabot PRs
- Treated as normal PRs: must pass `ci` and `security`
- Prefer merging grouped updates when checks are green
- If a dependency update is noisy, document exceptions in the PR thread (not in code)

## Release-please PRs
- `release-please` workflow is **not** a required check for normal PRs.
- Release PRs must still have required checks green:
  - `ci`
  - `security`
  - `commitlint`
- Merge Release PR via squash merge like any other PR.

## Emergency hotfix
- Still requires green checks
- Minimize scope; follow up with cleanup PR if needed
