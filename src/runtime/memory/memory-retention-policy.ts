/**
 * TGR-7.00 — Memory Privacy & Retention Policy
 *
 * Memory Core must remember, forget, and hide by rules.
 */

import { isAnyCreator } from "../../core/auth/runtime-access.js";
import type { TaskStatus } from "./memory-context-attachment.js";
import {
  CANONICAL_DECISION_CATEGORY,
  isCanonicalDecisionKey,
} from "./memory-canon-keys.js";

export type MemoryPrivacyLevel = "public" | "internal" | "creator_private" | "secret";

export type MemoryRetentionClass =
  | "ephemeral"
  | "session"
  | "working"
  | "long_term"
  | "evidence"
  | "canon";

export interface MemoryPolicyItem {
  key?: string;
  category?: string;
  type?: string;
  text?: string;
  value?: unknown;
  ref?: string;
  verified?: boolean;
  created_at?: number;
  expires_at?: number;
  task_status?: TaskStatus;
  explicitly_useful?: boolean;
  tags?: string[];
}

export interface MemoryRetentionPolicy {
  privacy: MemoryPrivacyLevel;
  retention: MemoryRetentionClass;
  ttl_ms: number | null;
  store_allowed: boolean;
  prompt_allowed: boolean;
  excerpt_only: boolean;
  verified_only: boolean;
}

export interface MemoryRetentionDecision {
  privacy: MemoryPrivacyLevel;
  retention: MemoryRetentionClass;
  allow_store: boolean;
  allow_prompt: boolean;
  redacted_text: string;
  sanitized_value?: unknown;
  expires_at?: number;
  reason?: string;
  policy: MemoryRetentionPolicy;
}

const SECRET_PATTERNS = [
  /(?:api[_-]?key|token|secret|password|bearer)\s*[:=]\s*\S+/gi,
  /sk-[a-zA-Z0-9]{20,}/g,
  /sbp_[a-zA-Z0-9]+/g,
];

export const RETENTION_TTL_MS: Record<MemoryRetentionClass, number | null> = {
  ephemeral: 15 * 60 * 1000,
  session: 24 * 60 * 60 * 1000,
  working: null,
  long_term: 90 * 24 * 60 * 60 * 1000,
  evidence: null,
  canon: null,
};

function keyOf(item: MemoryPolicyItem): string {
  return String(item.key ?? "").toLowerCase();
}

function categoryOf(item: MemoryPolicyItem): string {
  return String(item.category ?? item.type ?? "").toLowerCase();
}

function textOf(item: MemoryPolicyItem): string {
  if (item.text != null) return String(item.text);
  if (typeof item.value === "string") return item.value;
  if (item.value != null) {
    try {
      return JSON.stringify(item.value);
    } catch {
      return String(item.value);
    }
  }
  return "";
}

function containsSecretMaterial(text: string): boolean {
  const body = String(text ?? "");
  return SECRET_PATTERNS.some((p) => {
    p.lastIndex = 0;
    return p.test(body);
  });
}

/**
 * Classify privacy level for a memory item.
 */
export function classifyMemoryPrivacy(item: MemoryPolicyItem): MemoryPrivacyLevel {
  const text = textOf(item);
  const key = keyOf(item);
  const category = categoryOf(item);

  if (containsSecretMaterial(text)) return "secret";
  if (item.tags?.includes("secret")) return "secret";

  if (
    category.includes("creator") ||
    category.includes("debug") ||
    key.startsWith("creator.") ||
    key.includes("creator_private") ||
    item.tags?.includes("creator_private")
  ) {
    return "creator_private";
  }

  if (
    category.includes("evidence") ||
    category.includes("canon") ||
    category.includes("task_working") ||
    category.includes("internal") ||
    key.startsWith("task.") ||
    key.startsWith("canon.") ||
    key.startsWith("evidence.")
  ) {
    return "internal";
  }

  return "public";
}

/**
 * Classify retention bucket for a memory item.
 */
export function classifyMemoryRetention(item: MemoryPolicyItem): MemoryRetentionClass {
  const key = keyOf(item);
  const category = categoryOf(item);
  const type = String(item.type ?? "").toLowerCase();

  if (category.includes("ephemeral") || key.includes("ephemeral") || type === "ephemeral") {
    return "ephemeral";
  }
  if (
    category.includes(CANONICAL_DECISION_CATEGORY) ||
    category === "canonical" ||
    category.includes("canon") ||
    type === "canonical" ||
    isCanonicalDecisionKey(key)
  ) {
    return "canon";
  }
  if (category.includes("evidence") || type === "evidence" || key.startsWith("evidence.")) {
    return "evidence";
  }
  if (
    category.includes("task_working") ||
    key.endsWith(".working") ||
    type === "working"
  ) {
    return "working";
  }
  if (
    category.includes("session") ||
    type === "session" ||
    key.startsWith("session.")
  ) {
    return "session";
  }
  if (
    item.explicitly_useful ||
    category.includes("long_term") ||
    key.startsWith("user.") && key.includes("preferences")
  ) {
    return "long_term";
  }

  return "session";
}

function buildPolicy(
  privacy: MemoryPrivacyLevel,
  retention: MemoryRetentionClass,
  item: MemoryPolicyItem,
): MemoryRetentionPolicy {
  const verified_only = retention === "canon";
  const excerpt_only = retention === "evidence" || privacy === "secret";
  const prompt_allowed =
    privacy !== "secret" && !(verified_only && item.verified === false);
  const store_allowed = privacy !== "secret" || !containsSecretMaterial(textOf(item));

  return {
    privacy,
    retention,
    ttl_ms: RETENTION_TTL_MS[retention],
    store_allowed: privacy === "secret" ? true : store_allowed,
    prompt_allowed,
    excerpt_only,
    verified_only,
  };
}

export function redactMemorySecrets(text: string): string {
  let out = String(text ?? "");
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, "[REDACTED]");
  }
  return out;
}

function computeExpiresAt(
  retention: MemoryRetentionClass,
  item: MemoryPolicyItem,
  now: number,
): number | undefined {
  if (item.expires_at != null) return item.expires_at;

  const ttl = RETENTION_TTL_MS[retention];
  const created = item.created_at ?? now;

  if (retention === "ephemeral" && ttl != null) return created + ttl;
  if (retention === "session" && ttl != null) return created + ttl;
  if (retention === "long_term" && item.explicitly_useful && ttl != null) {
    return created + ttl;
  }
  if (retention === "working") {
    const status = item.task_status;
    if (status === "done" || status === "blocked") {
      return now;
    }
    return undefined;
  }

  return undefined;
}

function sanitizeValueForStore(
  item: MemoryPolicyItem,
  redactedText: string,
  retention: MemoryRetentionClass,
): unknown {
  if (item.value == null) return redactedText;
  if (typeof item.value === "string") return redactedText;

  if (Array.isArray(item.value)) {
    return item.value.map((v) => typeof v === "string" ? redactMemorySecrets(v) : v);
  }

  if (typeof item.value === "object" && !Array.isArray(item.value)) {
    const base = { ...(item.value as Record<string, unknown>) };
    for (const field of ["last_user", "last_assistant", "text", "summary", "content"]) {
      if (typeof base[field] === "string") {
        base[field] = redactMemorySecrets(String(base[field]));
      }
    }
    if (retention === "evidence") {
      delete base.full_text;
      delete base.raw_payload;
    }
    base._memory_policy = {
      retention,
      redacted: true,
      stored_at: new Date().toISOString(),
    };
    return base;
  }

  return redactedText;
}

/**
 * Apply privacy + retention rules before store / prompt use.
 */
export function applyMemoryRetentionPolicy(
  item: MemoryPolicyItem,
  now: number = Date.now(),
): MemoryRetentionDecision {
  const privacy = classifyMemoryPrivacy(item);
  const retention = classifyMemoryRetention(item);
  const policy = buildPolicy(privacy, retention, item);

  const rawText = textOf(item);
  const redacted_text = redactMemorySecrets(rawText);
  const expires_at = computeExpiresAt(retention, item, now);

  let allow_store = policy.store_allowed;
  let allow_prompt = policy.prompt_allowed;
  let reason: string | undefined;

  if (privacy === "secret") {
    allow_prompt = false;
    reason = "secret_never_in_prompt";
    if (containsSecretMaterial(rawText) && redacted_text === rawText) {
      allow_store = false;
      reason = "secret_blocked_from_store";
    }
  }

  if (retention === "canon" && item.verified === false) {
    allow_prompt = false;
    reason = reason ?? "canon_unverified_not_in_prompt";
  }

  if (retention === "long_term" && !item.explicitly_useful) {
    allow_store = false;
    reason = reason ?? "long_term_requires_explicit_usefulness";
  }

  const sanitized_value = allow_store
    ? sanitizeValueForStore(item, redacted_text, retention)
    : undefined;

  return {
    privacy,
    retention,
    allow_store,
    allow_prompt,
    redacted_text,
    sanitized_value,
    expires_at,
    reason,
    policy,
  };
}

/**
 * Whether a stored item should be purged at `now`.
 */
export function shouldExpireMemoryItem(
  item: MemoryPolicyItem,
  now: number = Date.now(),
): boolean {
  if (item.expires_at != null && now >= item.expires_at) return true;

  const retention = classifyMemoryRetention(item);
  const created = item.created_at ?? now;

  if (retention === "ephemeral") {
    const ttl = RETENTION_TTL_MS.ephemeral;
    return ttl != null && now - created >= ttl;
  }

  if (retention === "session") {
    const ttl = RETENTION_TTL_MS.session;
    return ttl != null && now - created >= ttl;
  }

  if (retention === "working") {
    const status = item.task_status;
    return status === "done" || status === "blocked";
  }

  return false;
}

export function isCreatorViewer(viewerUserId?: string | number | null): boolean {
  return isAnyCreator(viewerUserId);
}

/**
 * Prompt gate — secret never; creator_private only for Creator/admin.
 */
export function isMemoryAllowedInPrompt(
  item: MemoryPolicyItem,
  viewerUserId?: string | number | null,
): boolean {
  const decision = applyMemoryRetentionPolicy(item);
  if (!decision.allow_prompt) return false;

  if (decision.privacy === "creator_private" && !isCreatorViewer(viewerUserId)) {
    return false;
  }

  if (decision.retention === "canon" && item.verified === false) {
    return false;
  }

  return true;
}

export function privacyBlockReason(
  item: MemoryPolicyItem,
  viewerUserId?: string | number | null,
): string | undefined {
  const privacy = classifyMemoryPrivacy(item);
  if (privacy === "secret") return "privacy_secret_blocked";
  if (privacy === "creator_private" && !isCreatorViewer(viewerUserId)) {
    return "privacy_creator_private";
  }
  const retention = classifyMemoryRetention(item);
  if (retention === "canon" && item.verified === false) {
    return "canon_unverified_blocked";
  }
  if (!applyMemoryRetentionPolicy(item).allow_prompt) {
    return "retention_policy_blocked";
  }
  return undefined;
}

const MAX_EVIDENCE_PROMPT_CHARS = 220;

/**
 * Evidence enters prompt as ref/excerpt only (append-only store unchanged).
 */
export function sanitizeMemoryTextForPrompt(
  item: MemoryPolicyItem,
  maxLen = MAX_EVIDENCE_PROMPT_CHARS,
): { text: string; ref?: string } {
  const retention = classifyMemoryRetention(item);
  const redacted = redactMemorySecrets(item.text ?? textOf(item));
  const ref = item.ref ?? item.key;

  if (retention === "evidence") {
    const excerpt =
      redacted.length <= maxLen
        ? redacted
        : `${redacted.slice(0, maxLen)}… [len=${redacted.length}]`;
    return {
      text: ref ? `evidence_ref: ${ref} | ${excerpt}` : excerpt,
      ref,
    };
  }

  if (redacted.length <= maxLen) return { text: redacted, ref };
  return {
    text: `${redacted.slice(0, maxLen)}… [len=${redacted.length}]`,
    ref: ref ?? `excerpt:${redacted.length}`,
  };
}
