/**
 * TGP-17C — Capability Registry & Capability-Based Routing
 *
 * Fourth layer of the Adaptive Provider Runtime (v1.2):
 *
 *   User Request (needs: reasoning, json, tools, ...)
 *        ↓
 *   Capability Resolver  ── reads Capability Registry
 *        ↓  eligible provider candidates (capability-filtered)
 *   Health Runtime → Eligibility → Scoring Engine → Execution
 *
 * The capability layer is a PURE pre-filter: it never mutates health or scoring
 * state. It only narrows the candidate set to providers able to fulfill the
 * declared request capabilities. Providers lacking a required capability are
 * excluded BEFORE the health/scoring chain runs.
 *
 * Design constraints (aligned with TGP-17A/17B):
 * - Deterministic, no randomness.
 * - Declarative: a request declares `requiredCapabilities`; the registry decides.
 * - Sanitized: no keys/tokens/raw errors in diagnostics.
 * - Non-fatal: capability resolution failures must never block routing — they
 *   degrade to "all candidates pass" so the chain still works.
 */

import type { ProviderId } from "./provider-resolution.js";
import { selectBestProvider, rankProviders } from "./provider-scoring-engine.js";

/** Atomic capabilities a provider may offer. */
export type Capability =
  | "reasoning"
  | "tools"
  | "vision"
  | "json"
  | "code"
  | "long_context"
  | "video"
  | "audio"
  | "image"
  | "streaming"
  | "function_calling";

export const ALL_CAPABILITIES: Capability[] = [
  "reasoning",
  "tools",
  "vision",
  "json",
  "code",
  "long_context",
  "video",
  "audio",
  "image",
  "streaming",
  "function_calling",
];

/** Proficiency level for a capability — used for tie-breaking, not exclusion. */
export type CapabilityLevel = "none" | "basic" | "standard" | "advanced";

export interface ProviderCapabilityProfile {
  providerId: ProviderId;
  /** Capabilities this provider can fulfill. */
  capabilities: Partial<Record<Capability, CapabilityLevel>>;
  /** Human-readable note (never exposed to client). */
  note?: string;
}

export interface CapabilityResolutionResult {
  /** Candidate providers that satisfy ALL required capabilities. */
  eligible: ProviderId[];
  /** Candidate providers excluded because they lack >=1 required capability. */
  excluded: Array<{ providerId: ProviderId; missing: Capability[] }>;
  /** Required capabilities that were requested. */
  required: Capability[];
  /** Timestamp of the resolution. */
  timestamp: number;
}

/**
 * Default provider capability matrix.
 *
 * This is the declarative knowledge layer. It intentionally does NOT model
 * "web bridge" providers (openai_web, etc.) as full-capability — those are
 * fallback surfaces, not primary capability-bearing providers. API providers
 * carry the real capability profiles.
 */
export const DEFAULT_CAPABILITY_MATRIX: Record<ProviderId, ProviderCapabilityProfile> = {
  openai_api: {
    providerId: "openai_api",
    capabilities: {
      reasoning: "advanced",
      tools: "advanced",
      vision: "advanced",
      json: "advanced",
      code: "standard",
      function_calling: "advanced",
      streaming: "standard",
      audio: "standard",
      image: "advanced",
    },
    note: "Primary high-capability API provider",
  },
  openai_web: {
    providerId: "openai_web",
    capabilities: { reasoning: "advanced", json: "basic", streaming: "basic" },
    note: "Browser bridge fallback — limited capability surface",
  },
  qwen_api: {
    providerId: "qwen_api",
    capabilities: {
      reasoning: "standard",
      tools: "standard",
      code: "standard",
      json: "standard",
      function_calling: "standard",
      streaming: "standard",
      vision: "standard",
    },
    note: "Balanced API provider",
  },
  qwen_web: {
    providerId: "qwen_web",
    capabilities: { reasoning: "standard", json: "basic" },
    note: "Browser bridge fallback",
  },
  deepseek_api: {
    providerId: "deepseek_api",
    capabilities: {
      reasoning: "advanced",
      code: "advanced",
      json: "standard",
      function_calling: "standard",
      streaming: "standard",
    },
    note: "Strong reasoning + code provider",
  },
  deepseek_web: {
    providerId: "deepseek_web",
    capabilities: { reasoning: "advanced", json: "basic" },
    note: "Browser bridge fallback",
  },
  glm_local_web_api: {
    providerId: "glm_local_web_api",
    capabilities: { reasoning: "basic", json: "basic" },
    note: "Local web bridge",
  },
  kimi_api: {
    providerId: "kimi_api",
    capabilities: {
      reasoning: "advanced",
      long_context: "advanced",
      json: "standard",
      code: "standard",
      function_calling: "standard",
      streaming: "standard",
    },
    note: "Long-context reasoning provider",
  },
  kimi_local_web_api: {
    providerId: "kimi_local_web_api",
    capabilities: { reasoning: "standard", long_context: "basic" },
    note: "Browser bridge fallback",
  },
  kimi_free_local: {
    providerId: "kimi_free_local",
    capabilities: { reasoning: "basic", json: "basic" },
    note: "Local free Kimi surface",
  },
  zyloo_api: {
    providerId: "zyloo_api",
    capabilities: {
      reasoning: "advanced",
      long_context: "advanced",
      json: "standard",
      code: "standard",
      function_calling: "standard",
      streaming: "standard",
    },
    note: "Zyloo upstream (kimi-k3) — long-context reasoning",
  },
  local: {
    providerId: "local",
    capabilities: { reasoning: "basic", json: "basic", code: "basic" },
    note: "Local Ollama/LM Studio surface",
  },
};

/**
 * Capability Registry — the declarative knowledge layer for TGP-17C.
 *
 * Read-only consumer of the provider domain. Supports runtime override of
 * individual provider profiles (e.g., when a provider advertises a capability
 * after live verification).
 */
export class CapabilityRegistry {
  private matrix: Record<ProviderId, ProviderCapabilityProfile>;

  constructor(base: Record<ProviderId, ProviderCapabilityProfile> = DEFAULT_CAPABILITY_MATRIX) {
    this.matrix = structuredClone(base);
  }

  /** Get the capability profile for a single provider. */
  getProfile(providerId: ProviderId): ProviderCapabilityProfile | undefined {
    return this.matrix[providerId];
  }

  /** Does the provider expose the given capability at any non-none level? */
  hasCapability(providerId: ProviderId, capability: Capability): boolean {
    const profile = this.matrix[providerId];
    if (!profile) return false;
    const level = profile.capabilities[capability];
    return Boolean(level && level !== "none");
  }

  /** Level of a capability for a provider (defaults to "none"). */
  levelOf(providerId: ProviderId, capability: Capability): CapabilityLevel {
    const profile = this.matrix[providerId];
    return (profile?.capabilities[capability] as CapabilityLevel) || "none";
  }

  /** Override or extend a provider's capability profile at runtime. */
  setProfile(profile: ProviderCapabilityProfile): void {
    const existing = this.matrix[profile.providerId] || { providerId: profile.providerId, capabilities: {} };
    this.matrix[profile.providerId] = {
      providerId: profile.providerId,
      capabilities: { ...existing.capabilities, ...profile.capabilities },
      note: profile.note ?? existing.note,
    };
  }

  /** Revert to the default matrix. */
  reset(): void {
    this.matrix = structuredClone(DEFAULT_CAPABILITY_MATRIX);
  }

  /** List all provider ids known to the registry. */
  listProviders(): ProviderId[] {
    return Object.keys(this.matrix) as ProviderId[];
  }

  /**
   * Resolve which candidates among `candidates` can fulfill ALL `required`
   * capabilities. Providers not in the registry are treated as capable (fail-open)
   * so the layer never blocks routing due to missing registry data.
   */
  resolve(candidates: ProviderId[], required: Capability[]): CapabilityResolutionResult {
    const eligible: ProviderId[] = [];
    const excluded: Array<{ providerId: ProviderId; missing: Capability[] }> = [];

    for (const providerId of candidates) {
      const profile = this.matrix[providerId];
      // Fail-open: unknown provider → assumed capable.
      if (!profile) {
        eligible.push(providerId);
        continue;
      }
      const missing: Capability[] = [];
      for (const cap of required) {
        if (!this.hasCapability(providerId, cap)) {
          missing.push(cap);
        }
      }
      if (missing.length === 0) {
        eligible.push(providerId);
      } else {
        excluded.push({ providerId, missing });
      }
    }

    return {
      eligible,
      excluded,
      required: [...required],
      timestamp: Date.now(),
    };
  }
}

/** Shared singleton used by the Router and diagnostics. */
export const capabilityRegistry = new CapabilityRegistry();

/**
 * Convenience helper for the routing chain: given a candidate list and required
 * capabilities, return only the capable providers. Fail-open on any error so
 * capability resolution can never break the runtime.
 */
export function filterCapableProviders(
  candidates: ProviderId[],
  required: Capability[],
  registry: CapabilityRegistry = capabilityRegistry,
): ProviderId[] {
  try {
    return registry.resolve(candidates, required).eligible;
  } catch {
    return [...candidates];
  }
}

/**
 * End-to-end capability resolution result that also carries the downstream
 * health/scoring verdict, so the Router has a single structured decision.
 */
export interface ProviderSelectionPlan {
  /** Original candidate set. */
  candidates: ProviderId[];
  /** Declared required capabilities. */
  required: Capability[];
  /** Providers excluded purely on capability grounds. */
  capabilityExcluded: Array<{ providerId: ProviderId; missing: Capability[] }>;
  /** Providers that passed capability filter. */
  capabilityEligible: ProviderId[];
  /** Final ordered ranking (capability-eligible AND health-eligible). */
  ranked: ProviderId[];
  /** Provider selected as best (top of ranking), or null if none. */
  selected: ProviderId | null;
  timestamp: number;
}

/**
 * Build a full selection plan:
 *   Capability filter → Health eligibility → Scoring ranking.
 *
 * This is the canonical TGP-17C entry point for the Router's `auto` path.
 * Every stage is fail-open: if a downstream layer errors, we degrade
 * gracefully rather than blocking the request.
 */
export function planProviderSelection(
  candidates: ProviderId[],
  required: Capability[],
  registry: CapabilityRegistry = capabilityRegistry,
): ProviderSelectionPlan {
  const timestamp = Date.now();

  const capResult = (() => {
    try {
      return registry.resolve(candidates, required);
    } catch {
      return { eligible: [...candidates], excluded: [], required: [...required], timestamp };
    }
  })();

  const capabilityEligible = capResult.eligible;

  let ranked: ProviderId[] = [];
  let selected: ProviderId | null = null;
  try {
    const rankedResult = selectBestProvider(capabilityEligible);
    selected = rankedResult ? (rankedResult.providerId as ProviderId) : null;
    // Re-derive ordered list for diagnostics by replaying rankProviders.
    const full = rankProviders(capabilityEligible);
    ranked = full.ranked.map((r) => r.providerId as ProviderId);
  } catch {
    // Scoring unavailable — fall back to capability-eligible order as-is.
    ranked = [...capabilityEligible];
    selected = capabilityEligible[0] ?? null;
  }

  return {
    candidates: [...candidates],
    required: [...required],
    capabilityExcluded: capResult.excluded,
    capabilityEligible,
    ranked,
    selected,
    timestamp,
  };
}
