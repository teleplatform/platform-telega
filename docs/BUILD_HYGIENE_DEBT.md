# Build Hygiene Debt Register (BH.1)

Purpose: track temporary compile-time suppressions introduced to restore a green build without changing runtime behavior.

## Open Debt Items

1. `BH-TD-INTEL-001`
- Scope: `/src/intel/*.ts`
- Current state: `// @ts-nocheck` is applied across Intel legacy files.
- Why: temporary suppression of NodeNext import/type noise during BH stabilization.
- Exit criteria:
  - Remove all `// @ts-nocheck` from `src/intel`.
  - Keep `npm run -s build` green.
  - Keep `npm run -s smoke:k1.3` and `npm run -s smoke:k2` green.

2. `BH-TD-I18N-001`
- Scope: `/src/i18n/messages.ts`
- Current state: `// @ts-nocheck` is applied.
- Why: temporary suppression of strict shape-mismatch typing in localized message bundles.
- Exit criteria:
  - Remove `// @ts-nocheck` from `src/i18n/messages.ts`.
  - Restore strict compile-time shape guarantees for locale dictionaries.
  - Keep `npm run -s build` green.
  - Keep `npm run -s smoke:k1.3` and `npm run -s smoke:k2` green.

## Global Closure Rule

`BH` is considered fully debt-clean only when build is green with zero `@ts-nocheck` in the BH scopes above.
