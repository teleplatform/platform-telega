# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
- (add changes here)

## [1.1.0-rc.1] - 2026-05-21

### Added
- Production Activation v1 release candidate for the KCA Civilization Stack.
- Living Runtime Civilization Loop hardening suite covering route governance, evidence completeness, replay, Mission Control feed, mode matrix, burn-rate monitoring, incident auto-closure, and baseline freeze.
- Production readiness suite covering live-loop trace inspection, governance failure matrix, budget consistency audit, mode boundary audit, incident regressions, Mission Control feed validation, and production activation freeze.
- `trace:inspect -- --trace <trace_id> --living-loop --json` for auditable loop inspection.
- CI gate for `test:living-loop-hardening`.

### Fixed
- Creator-mode shell and federation governance now preserve mode when consuming runtime budget.
- Evolution governance now avoids consuming planning budget after primary governance blockers.

### Release
- Version tag: `v1.1.0-rc.1`.
- Production freeze: `.data/civilization/production-activation-freeze.json`.
- Production readiness trace: `88b6f4549809b970`.
