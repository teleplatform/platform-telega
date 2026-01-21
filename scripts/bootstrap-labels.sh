#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required."
  echo "Install: https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Please authenticate first: gh auth login"
  exit 1
fi

if ! gh repo view >/dev/null 2>&1; then
  echo "Run this inside a cloned GitHub repository."
  exit 1
fi

# Label format: name|color|description
labels=(
  "feature|1D76DB|New functionality"
  "feat|1D76DB|Feature (alias)"
  "fix|D73A4A|Bug fix"
  "bug|D73A4A|Bug report"
  "docs|0E8A16|Documentation"
  "ci|5319E7|CI/workflows"
  "chore|C2E0C6|Maintenance"
  "dependencies|0366D6|Dependency updates"
  "deps|0366D6|Dependencies (alias)"
)

for entry in "${labels[@]}"; do
  IFS="|" read -r name color description <<<"$entry"
  gh label create "$name" --color "$color" --description "$description" --force
  echo "label: $name"
done
