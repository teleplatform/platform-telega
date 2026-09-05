import { FailureClass } from "./repairTypes";

const CLASSIFIERS: Array<{ pattern: RegExp; cls: FailureClass }> = [
  { pattern: /TypeError/i, cls: "type_error" },
  { pattern: /ReferenceError/i, cls: "type_error" },
  { pattern: /SyntaxError/i, cls: "type_error" },
  { pattern: /test.*fail/i, cls: "test_failure" },
  { pattern: /expected.*received/i, cls: "test_failure" },
  { pattern: /lint/i, cls: "lint_failure" },
  { pattern: /eslint/i, cls: "lint_failure" },
  { pattern: /exception/i, cls: "runtime_exception" },
  { pattern: /timeout/i, cls: "runtime_exception" },
  { pattern: /verification.*fail/i, cls: "verification_failed" },
  { pattern: /hash.*mismatch/i, cls: "verification_failed" },
  { pattern: /conflict/i, cls: "patch_conflict" },
  { pattern: /patch.*conflict/i, cls: "patch_conflict" },
];

export function classifyFailure(error: string): FailureClass {
  for (const c of CLASSIFIERS) {
    if (c.pattern.test(error)) return c.cls;
  }
  return "unknown";
}

export function isRetryable(failureClass: FailureClass): boolean {
  return !["patch_conflict", "verification_failed"].includes(failureClass);
}

export function requiresHumanReview(failureClass: FailureClass): boolean {
  return ["patch_conflict"].includes(failureClass);
}
