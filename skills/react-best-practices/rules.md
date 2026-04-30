# React Best Practices — Lint Brain (v1)

Scope: React + Next.js code, lightweight best-practices checks.

Hooks:
- missing deps in useEffect/useMemo/useCallback
- conditional hooks

Performance:
- inline handlers causing rerenders where critical
- missing memoization for heavy lists

Next.js:
- prefer next/image for images
- "use client" only when required

State:
- avoid derived state anti-pattern

DX:
- avoid any
- add explicit return types where critical
