/**
 * Voice Secret Injection Guard — V12.7
 *
 * First-class entity: VoiceSecretInjectionGuard
 *
 * This layer answers:
 *   - "May this secret be injected into the message?"
 *   - "What security constraints apply to this injection?"
 *   - "Should the output be masked?"
 *
 * RULE: NO SECRET MAY BE INJECTED WITHOUT SECURITY POLICY CHECK
 */

export type VoiceSecurityConstraint =
  | "mask_output"
  | "no_full_exposure"
  | "audit_log_required"
  | "rate_limited"
  | "user_authorized"
  | "single_use";

export interface VoiceSecretInjectionGuard {
  guardId: string;
  alias: string;
  allowed: boolean;
  constraints: VoiceSecurityConstraint[];
  reason?: string;
  maskPattern?: "first4_last4" | "all_masked" | "none";
  autoDeleteAfterSec?: number;
  evaluatedAt: number;
}

export type VoiceInjectionGuardError =
  | "alias_not_allowed"
  | "sensitive_category_blocked"
  | "rate_limit_exceeded"
  | "user_not_authorized";

// ============================================================================
// Sensitive categories (never allowed for full exposure)
// ============================================================================

const SENSITIVE_CATEGORIES = new Set([
  "password",
  "secret",
  "private_key",
  "api_key",
  "token",
  "credential",
]);

// ============================================================================
// Guard evaluation
// ============================================================================

export interface VoiceInjectionGuardInput {
  alias: string;
  userId?: string;
  allowInjection: boolean;
  rateLimit?: number; // max injections per minute
  currentRate?: number;
}

/**
 * Evaluate whether a secret may be injected.
 * Pure function — applies security policy.
 */
export function evaluateSecretInjectionGuard(
  input: VoiceInjectionGuardInput,
): VoiceSecretInjectionGuard {
  const constraints: VoiceSecurityConstraint[] = [];
  let allowed = input.allowInjection;
  let reason: string | undefined;

  if (!input.allowInjection) {
    reason = "Secret injection is disabled";
  }

  // Check rate limit
  if (input.rateLimit !== undefined && input.currentRate !== undefined) {
    constraints.push("rate_limited");
    if (input.currentRate >= input.rateLimit) {
      allowed = false;
      reason = `Rate limit exceeded: ${input.currentRate}/${input.rateLimit}`;
    }
  }

  // Determine mask pattern based on alias
  const [, category] = input.alias.split(":");
  const isSensitive =
    category && SENSITIVE_CATEGORIES.has(category.toLowerCase());

  if (isSensitive) {
    constraints.push("mask_output");
    constraints.push("no_full_exposure");
  }

  constraints.push("audit_log_required");

  const maskPattern: VoiceSecretInjectionGuard["maskPattern"] = isSensitive
    ? "first4_last4"
    : "none";

  return {
    guardId: `inj_guard_${Date.now()}`,
    alias: input.alias,
    allowed,
    constraints,
    reason,
    maskPattern,
    autoDeleteAfterSec: isSensitive ? 30 : undefined,
    evaluatedAt: Date.now(),
  };
}

// ============================================================================
// Value masking
// ============================================================================

export function maskSecretValue(
  value: string,
  pattern: "first4_last4" | "all_masked" | "none",
): string {
  switch (pattern) {
    case "first4_last4":
      if (value.length <= 10) return "***";
      return `${value.slice(0, 4)}...${value.slice(-4)}`;

    case "all_masked":
      return "***";

    case "none":
      return value;

    default:
      return "***";
  }
}

// ============================================================================
// Validation
// ============================================================================

export function validateInjectionGuard(
  guard: Partial<VoiceSecretInjectionGuard>,
): VoiceInjectionGuardError[] {
  const errors: VoiceInjectionGuardError[] = [];

  if (!guard.alias) {
    errors.push("alias_not_allowed");
  }

  return errors;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatSecretInjectionGuard(
  guard: VoiceSecretInjectionGuard,
): string {
  const status = guard.allowed ? "✅ ALLOWED" : "❌ BLOCKED";

  return [
    `🔒 Secret Injection Guard`,
    `• guard ID: ${guard.guardId}`,
    `• alias: ${guard.alias}`,
    `• status: ${status}`,
    guard.reason ? `• reason: ${guard.reason}` : null,
    `• constraints: ${guard.constraints.join(", ")}`,
    guard.maskPattern ? `• mask: ${guard.maskPattern}` : null,
    guard.autoDeleteAfterSec ? `• auto-delete: ${guard.autoDeleteAfterSec}s` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
