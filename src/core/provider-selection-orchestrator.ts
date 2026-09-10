/**
 * TGP-17D — Provider Selection Orchestrator
 *
 * Single canonical provider-selection authority for ALL routable requests,
 * including explicit provider-prefixed routes.
 *
 * Canonical pipeline:
 *   Request intent
 *     → Route constraint parsing
 *     → Capability resolution (TGP-17C)
 *     → Candidate construction
 *     → Health eligibility (TGP-17A)
 *     → Scoring (TGP-17B)
 *     → Selection plan
 *     → Execution
 *     → Failure policy
 *     → Fallback (consumes plan.fallbackOrder)
 *     → Evidence
 *
 * Core principle (per plan):
 *   explicit route ≠ bypass policy
 * A prefix expresses a PREFERENCE or REQUIREMENT, never an unconditional
 * execution command. Capability, health, circuit, cooldown, and eligibility
 * checks always apply.
 *
 * Failure classification remains owned by ProviderFailurePolicy.
 * Scoring engine is NOT contaminated with route-prefix policy — preference is
 * applied as an orchestration-level precedence rule (TGP-17D.6).
 */

import type { ProviderId } from "./provider-resolution.js";
import type { Capability } from "./provider-capability-registry.js";
import {
  CapabilityRegistry,
  capabilityRegistry,
  DEFAULT_CAPABILITY_MATRIX,
  ALL_CAPABILITIES,
} from "./provider-capability-registry.js";
import {
  rankProviders,
  selectBestProvider,
} from "./provider-scoring-engine.js";
import {
  isProviderEligible,
  getSnapshot,
} from "./provider-health-runtime.js";
import { appendEvidenceRecord } from "../runtime/evidence/execution-evidence-store.js";
import { hashTraceId } from "../runtime/evidence/execution-hash.js";

// ─── Route intent contract ────────────────────────────────────────────────────

export type RouteMode = "auto" | "preferred_provider" | "required_provider";

export type RouteSource =
  | "auto"
  | "model_prefix"
  | "request_metadata"
  | "runtime_policy";

export interface ProviderRouteIntent {
  mode: RouteMode;
  requestedProviderId?: ProviderId;
  /** Provider family hint (e.g. "kimi", "zyloo") when only a family is given. */
  requestedProviderFamily?: string;
  /** Resolved model name after stripping the prefix. */
  requestedModel?: string;
  allowFallback: boolean;
  requiredCapabilities: Capability[];
  source: RouteSource;
}

// ─── Sanitized rejection reasons ──────────────────────────────────────────────

export type SelectionRejectionReason =
  | "missing_capability"
  | "provider_unavailable"
  | "circuit_open"
  | "cooldown_active"
  | "unknown_provider"
  | "strict_route_unavailable";

export interface RejectedProvider {
  providerId: ProviderId;
  reason: SelectionRejectionReason;
}

// ─── Canonical selection plan (immutable) ─────────────────────────────────────

export interface ProviderSelectionPlan {
  requestId?: string;
  intent: ProviderRouteIntent;
  requiredCapabilities: Capability[];
  consideredProviders: ProviderId[];
  capabilityRejected: RejectedProvider[];
  healthRejected: RejectedProvider[];
  eligibleProviders: ProviderId[];
  rankedProviders: Array<{ providerId: ProviderId; score: number }>;
  selectedProviderId?: ProviderId;
  selectedModel?: string;
  fallbackOrder: ProviderId[];
  terminalReason?: string;
  timestamp: number;
}

// ─── Dispatcher observer port (Phase 6C) ──────────────────────────────────────
//
// The routing core never imports @tele-gpt/dispatcher-core. The composition
// root (src/server) implements this port and injects it via
// setDispatcherRoutingObserver. When absent, planProviderSelectionV2 behaves
// exactly as before 6C.

export type DispatcherOverrideKind = "none" | "prefer";

export interface DispatcherOverridePrefer {
  providerId: ProviderId;
  model?: string;
  ruleId?: string;
}

export type DispatcherOverride =
  | { kind: "none" }
  | { kind: "prefer"; prefer: DispatcherOverridePrefer };

export interface DispatcherRoutingFacts {
  requestId?: string;
  intent: ProviderRouteIntent;
  requiredCapabilities: Capability[];
  consideredProviders: ProviderId[];
  eligibleProviders: ProviderId[];
  rankedProviders: Array<{ providerId: ProviderId; score: number }>;
  selectedProviderId?: ProviderId;
  selectedModel?: string;
  fallbackOrder: ProviderId[];
  timestamp: number;
}

export interface DispatcherRoutingObserver {
  observe(facts: DispatcherRoutingFacts): DispatcherOverride;
}

let dispatcherRoutingObserver: DispatcherRoutingObserver | undefined;

export function setDispatcherRoutingObserver(
  observer: DispatcherRoutingObserver | undefined,
): void {
  dispatcherRoutingObserver = observer;
}

export function getDispatcherRoutingObserver(): DispatcherRoutingObserver | undefined {
  return dispatcherRoutingObserver;
}

// ─── Canonical selection errors (sanitized) ───────────────────────────────────

export type SelectionErrorCode =
  | "NO_CAPABLE_PROVIDER"
  | "NO_ELIGIBLE_PROVIDER"
  | "REQUIRED_PROVIDER_UNKNOWN"
  | "REQUIRED_PROVIDER_UNAVAILABLE"
  | "SELECTION_PLAN_EXHAUSTED";

export class ProviderSelectionError extends Error {
  code: SelectionErrorCode;
  statusCode: number;
  details: {
    mode: RouteMode;
    requestedProviderId?: ProviderId;
    requiredCapabilities: Capability[];
    consideredProviderIds: ProviderId[];
    rejectionReasonCodes: SelectionRejectionReason[];
  };
  constructor(
    code: SelectionErrorCode,
    message: string,
    statusCode: number,
    details: ProviderSelectionError["details"],
  ) {
    super(message);
    this.name = "ProviderSelectionError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/** HTTP mapping for selection errors — expected outcomes never return 500. */
export const SELECTION_ERROR_HTTP: Record<SelectionErrorCode, number> = {
  REQUIRED_PROVIDER_UNKNOWN: 400,
  NO_CAPABLE_PROVIDER: 503,
  NO_ELIGIBLE_PROVIDER: 503,
  REQUIRED_PROVIDER_UNAVAILABLE: 503,
  SELECTION_PLAN_EXHAUSTED: 503,
};

// ─── Prefix parsing (TGP-17D.1) ───────────────────────────────────────────────

/**
 * Map a model string to a ProviderRouteIntent.
 *
 * Rules:
 * - "auto" → auto mode (all candidates).
 * - "kimi:...", "zyloo:..." etc. → preferred_provider (NOT strict) to preserve
 *   existing compatibility: current prefixes are treated as preferences unless
 *   runtime_policy configures them as required.
 * - Unknown prefixes → deterministic: treated as local (existing behavior) with
 *   a preferred_provider intent pointing at local.
 * - A strict-pin request is only produced from explicit runtime_policy / metadata.
 */
const PREFIX_TO_PROVIDER: Record<string, ProviderId> = {
  openai: "openai_api",
  openai_api: "openai_api",
  qwen: "qwen_api",
  qwen_api: "qwen_api",
  deepseek: "deepseek_api",
  deepseek_api: "deepseek_api",
  local: "local",
  chatgpt: "chatgpt_web",
  openai_web: "openai_web",
  qwen_web: "qwen_web",
  deepseek_web: "deepseek_web",
  kimi: "kimi_api",
  kimi_api: "kimi_api",
  kimi_web: "kimi_web",
  kimi_free_local: "kimi_free_local",
  kimi_local_web_api: "kimi_local_web_api",
  zyloo: "zyloo_api",
  zyloo_api: "zyloo_api",
  glm: "glm_api",
  glm_api: "glm_api",
  glm_local_web_api: "glm_local_web_api",
  mimo: "mimo_api",
  mimo_api: "mimo_api",
  minimax: "minimax",
  grok_web: "grok_web",
  perplexity_web: "perplexity_web",
  claude_web: "claude_web",
  gemini_web: "gemini_web",
  poe_web: "poe_web",
};

/** Family hint derived from a prefix, for diagnostics. */
const PREFIX_FAMILY: Record<string, string> = {
  kimi: "kimi",
  kimi_api: "kimi",
  kimi_web: "kimi",
  kimi_free_local: "kimi",
  kimi_local_web_api: "kimi",
  zyloo: "zyloo",
  zyloo_api: "zyloo",
  openai: "openai",
  openai_api: "openai",
  qwen: "qwen",
  deepseek: "deepseek",
};

export interface ParseRouteOptions {
  /** Force a strict (required_provider) route regardless of prefix. */
  strict?: boolean;
  /** Disable fallback even for preferred routes. */
  noFallback?: boolean;
  /** Explicit required capability list from request metadata. */
  requiredCapabilities?: Capability[];
}

export function parseRouteIntent(
  model: string | undefined,
  options: ParseRouteOptions = {},
): ProviderRouteIntent {
  const raw = (model || "").trim();
  const requiredCaps = (options.requiredCapabilities || []).filter((c) =>
    ALL_CAPABILITIES.includes(c),
  );

  if (!raw || raw === "auto") {
    return {
      mode: "auto",
      allowFallback: true,
      requiredCapabilities: requiredCaps,
      source: "auto",
    };
  }

  const firstColon = raw.indexOf(":");
  const prefixRaw = firstColon === -1 ? raw.toLowerCase() : raw.slice(0, firstColon).trim().toLowerCase();
  const modelPart = firstColon === -1 ? "" : raw.slice(firstColon + 1).trim();

  const providerId = PREFIX_TO_PROVIDER[prefixRaw];

  if (!providerId) {
    // Unknown prefix → deterministic fallback to local (preserves existing behavior).
    return {
      mode: "preferred_provider",
      requestedProviderId: "local",
      requestedProviderFamily: prefixRaw,
      requestedModel: raw,
      allowFallback: options.noFallback ? false : true,
      requiredCapabilities: requiredCaps,
      source: "model_prefix",
    };
  }

  const strict = options.strict === true;
  return {
    mode: strict ? "required_provider" : "preferred_provider",
    requestedProviderId: providerId,
    requestedProviderFamily: PREFIX_FAMILY[prefixRaw],
    requestedModel: modelPart || undefined,
    allowFallback: strict ? (options.noFallback ? false : true) : options.noFallback ? false : true,
    requiredCapabilities: requiredCaps,
    source: "model_prefix",
  };
}

// ─── Candidate construction (TGP-17D.2) ───────────────────────────────────────

/** Stable canonical provider order used for fallbacks. */
export const CANONICAL_PROVIDER_ORDER: ProviderId[] = [
  "openai_api",
  "kimi_api",
  "zyloo_api",
  "deepseek_api",
  "qwen_api",
  "glm_api",
  "kimi_local_web_api",
  "kimi_free_local",
  "openai_web",
  "qwen_web",
  "deepseek_web",
  "kimi_web",
  "local",
  "glm_local_web_api",
  "mimo_api",
  "mimo_browser_discovery",
  "minimax",
  "grok_web",
  "perplexity_web",
  "claude_web",
  "gemini_web",
  "poe_web",
];

/**
 * Build the candidate set for an intent. No raw error inspection, no health
 * internals — purely structural.
 */
export function buildProviderCandidates(
  intent: ProviderRouteIntent,
  registry: CapabilityRegistry = capabilityRegistry,
): ProviderId[] {
  const knownProviders = registry.listProviders();

  if (intent.mode === "auto") {
    // All registered providers, canonical order, de-duplicated.
    const ordered: ProviderId[] = [];
    const seen = new Set<ProviderId>();
    for (const p of CANONICAL_PROVIDER_ORDER) {
      if (knownProviders.includes(p) && !seen.has(p)) {
        ordered.push(p);
        seen.add(p);
      }
    }
    for (const p of knownProviders) {
      if (!seen.has(p)) {
        ordered.push(p);
        seen.add(p);
      }
    }
    return ordered;
  }

  if (intent.mode === "required_provider") {
    if (!intent.requestedProviderId) return [];
    // Single candidate; duplicates impossible.
    return [intent.requestedProviderId];
  }

  // preferred_provider: requested first, then remaining in canonical order.
  const requested = intent.requestedProviderId;
  const ordered: ProviderId[] = [];
  const seen = new Set<ProviderId>();
  if (requested && !seen.has(requested)) {
    ordered.push(requested);
    seen.add(requested);
  }
  for (const p of CANONICAL_PROVIDER_ORDER) {
    if (knownProviders.includes(p) && !seen.has(p)) {
      ordered.push(p);
      seen.add(p);
    }
  }
  for (const p of knownProviders) {
    if (!seen.has(p)) {
      ordered.push(p);
      seen.add(p);
    }
  }
  return ordered;
}

// ─── Orchestration (TGP-17D.2 / 17D.3) ────────────────────────────────────────

/**
 * Emit selection.planned evidence (non-blocking, fire-and-forget).
 */
async function emitSelectionPlanned(plan: ProviderSelectionPlan): Promise<void> {
  try {
    const rejectionReasonCodes = [
      ...plan.capabilityRejected.map((r) => r.reason),
      ...plan.healthRejected.map((r) => r.reason),
    ];
    await appendEvidenceRecord({
      evidence_id: hashTraceId(plan.requestId || "selection", "provider_selection_planned"),
      trace_id: plan.requestId || "selection",
      job_id: "provider_selection",
      type: "provider.selection.planned" as any,
      timestamp: new Date(plan.timestamp).toISOString(),
      payload: {
        routeMode: plan.intent.mode,
        requestedProviderId: plan.intent.requestedProviderId,
        requiredCapabilities: plan.requiredCapabilities,
        consideredProviderIds: plan.consideredProviders,
        selectedProviderId: plan.selectedProviderId,
        fallbackOrder: plan.fallbackOrder,
        rejectionReasonCodes,
      },
    });
  } catch {
    // non-fatal
  }
}

/**
 * Build the complete immutable selection plan for an intent.
 */
export function planProviderSelectionV2(
  intent: ProviderRouteIntent,
  requestId?: string,
  registry: CapabilityRegistry = capabilityRegistry,
): ProviderSelectionPlan {
  const timestamp = Date.now();
  const candidates = buildProviderCandidates(intent, registry);

  // 1. Capability resolution
  const capResult = (() => {
    try {
      return registry.resolve(candidates, intent.requiredCapabilities);
    } catch {
      return { eligible: candidates, excluded: [], required: intent.requiredCapabilities, timestamp };
    }
  })();

  const capabilityRejected: RejectedProvider[] = capResult.excluded.map((e) => ({
    providerId: e.providerId,
    reason: "missing_capability" as const,
  }));

  // 2. Health eligibility (only among capable candidates)
  const healthRejected: RejectedProvider[] = [];
  const eligible: ProviderId[] = [];
  for (const p of capResult.eligible) {
    let ok = true;
    let reason: SelectionRejectionReason = "provider_unavailable";
    try {
      const snap = getSnapshot(p);
      if (!snap) {
        ok = true; // unknown → assume eligible (fail-open)
      } else if (snap.circuitState === "open") {
        ok = false;
        reason = "circuit_open";
      } else if (snap.status === "unavailable") {
        ok = false;
        reason = "provider_unavailable";
      } else if (!isProviderEligible(p)) {
        ok = false;
        reason = "cooldown_active";
      }
    } catch {
      ok = true; // fail-open
    }
    if (ok) eligible.push(p);
    else healthRejected.push({ providerId: p, reason });
  }

  // 3. Scoring ranking of eligible
  let rankedProviders: Array<{ providerId: ProviderId; score: number }> = [];
  try {
    const r = rankProviders(eligible);
    rankedProviders = r.ranked.map((x) => ({ providerId: x.providerId as ProviderId, score: x.score }));
  } catch {
    rankedProviders = eligible.map((p) => ({ providerId: p, score: 0 }));
  }

  // 4. Preference precedence (TGP-17D.6): requested first if capable+eligible.
  let selectedProviderId: ProviderId | undefined;
  let fallbackOrder: ProviderId[] = [];

  if (intent.mode === "required_provider") {
    const req = intent.requestedProviderId!;
    const knownProviders = registry.listProviders();
    if (!knownProviders.includes(req)) {
      throw new ProviderSelectionError(
        "REQUIRED_PROVIDER_UNKNOWN",
        "Required provider is not a known provider.",
        400,
        {
          mode: intent.mode,
          requestedProviderId: req,
          requiredCapabilities: intent.requiredCapabilities,
          consideredProviderIds: candidates,
          rejectionReasonCodes: ["unknown_provider"],
        },
      );
    }
    const reqCapable = capResult.eligible.includes(req);
    const reqHealthy = eligible.includes(req);
    if (!reqCapable) {
      throw new ProviderSelectionError(
        "REQUIRED_PROVIDER_UNAVAILABLE",
        "Required provider cannot fulfill the requested capabilities.",
        503,
        {
          mode: intent.mode,
          requestedProviderId: req,
          requiredCapabilities: intent.requiredCapabilities,
          consideredProviderIds: candidates,
          rejectionReasonCodes: ["missing_capability"],
        },
      );
    }
    if (!reqHealthy) {
      const reason = healthRejected.find((h) => h.providerId === req)?.reason || "provider_unavailable";
      throw new ProviderSelectionError(
        "REQUIRED_PROVIDER_UNAVAILABLE",
        "Required provider is currently unavailable.",
        503,
        {
          mode: intent.mode,
          requestedProviderId: req,
          requiredCapabilities: intent.requiredCapabilities,
          consideredProviderIds: candidates,
          rejectionReasonCodes: [reason],
        },
      );
    }
    selectedProviderId = req;
    fallbackOrder = intent.allowFallback ? eligible.filter((p) => p !== req) : [];
  } else {
    // auto / preferred: preference precedence
    let ranked = rankedProviders.map((r) => r.providerId);
    if (intent.mode === "preferred_provider" && intent.requestedProviderId) {
      const req = intent.requestedProviderId;
      if (eligible.includes(req)) {
        // move requested to front, preserving ranked relative order for the rest
        ranked = [req, ...ranked.filter((p) => p !== req)];
      }
    }
    selectedProviderId = ranked[0];
    fallbackOrder = intent.allowFallback ? ranked.slice(1) : [];
  }

  // Terminal reason if nothing eligible
  let terminalReason: string | undefined;
  if (!selectedProviderId) {
    if (capResult.eligible.length === 0) {
      terminalReason = "NO_CAPABLE_PROVIDER";
      throw new ProviderSelectionError(
        "NO_CAPABLE_PROVIDER",
        "No provider is capable of fulfilling the requested capabilities.",
        503,
        {
          mode: intent.mode,
          requestedProviderId: intent.requestedProviderId,
          requiredCapabilities: intent.requiredCapabilities,
          consideredProviderIds: candidates,
          rejectionReasonCodes: capabilityRejected.map((r) => r.reason),
        },
      );
    }
    terminalReason = "NO_ELIGIBLE_PROVIDER";
    throw new ProviderSelectionError(
      "NO_ELIGIBLE_PROVIDER",
      "No provider is currently eligible (all unhealthy or circuit-open).",
      503,
      {
        mode: intent.mode,
        requestedProviderId: intent.requestedProviderId,
        requiredCapabilities: intent.requiredCapabilities,
        consideredProviderIds: candidates,
        rejectionReasonCodes: healthRejected.map((r) => r.reason),
      },
    );
  }

  // Emit selection planned evidence (non-blocking)
  const plan: ProviderSelectionPlan = {
    requestId,
    intent,
    requiredCapabilities: intent.requiredCapabilities,
    consideredProviders: candidates,
    capabilityRejected,
    healthRejected,
    eligibleProviders: eligible,
    rankedProviders,
    selectedProviderId,
    selectedModel: intent.requestedModel,
    fallbackOrder,
    terminalReason,
    timestamp,
  };
  const dispatcherObserver = getDispatcherRoutingObserver();
  if (dispatcherObserver) {
    try {
      dispatcherObserver.observe({
        requestId,
        intent,
        requiredCapabilities: intent.requiredCapabilities,
        consideredProviders: candidates,
        eligibleProviders: eligible,
        rankedProviders,
        selectedProviderId,
        selectedModel: intent.requestedModel,
        fallbackOrder,
        timestamp,
      });
    } catch {
      // fail-open: observation is advisory only
    }
  }
  emitSelectionPlanned(plan).catch(() => {});
  return plan;
}

/** Convenience: returns plan or throws sanitized ProviderSelectionError. */
export function selectProvider(
  model: string | undefined,
  options: ParseRouteOptions & { requestId?: string } = {},
): ProviderSelectionPlan {
  const intent = parseRouteIntent(model, options);
  return planProviderSelectionV2(intent, options.requestId);
}
