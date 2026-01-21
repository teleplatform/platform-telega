# Labels

This repo uses labels to power release notes grouping and PR automation.

## Bootstrap
Create labels automatically (requires GitHub CLI):

```bash
./scripts/bootstrap-labels.sh
```

## Required labels
- feature
- feat
- fix
- bug
- docs
- ci
- chore
- dependencies
- deps

These labels map to `.github/release.yml` categories and labeler rules.
