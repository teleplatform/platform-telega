#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: ./scripts/release.sh vX.Y.Z"
  exit 1
fi

TAG="$1"

# Basic tag validation
if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid tag format. Expected vMAJOR.MINOR.PATCH"
  exit 1
fi

echo "==> Fetching latest main..."
git fetch origin main

echo "==> Checking working tree..."
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes first."
  exit 1
fi

echo "==> Ensuring we are on main..."
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  echo "Not on main branch. Current: $BRANCH"
  exit 1
fi

echo "==> Pulling latest main..."
git pull origin main

echo "==> Running build..."
npm ci
npm run build

echo "==> Creating annotated tag: $TAG"
git tag -a "$TAG" -m "release: $TAG"

echo "==> Pushing tag..."
git push origin "$TAG"

echo "==> Done ✅ Release tag pushed: $TAG"
