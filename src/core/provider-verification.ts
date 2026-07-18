import { appendEvidenceRecord } from "../runtime/evidence/execution-evidence-store.js";
import { isKimiFamilyModel, isKimiApiProvider, resolveKimiApiKey } from "../providers/kimi_api/index.js";
import { isKimiLocalWebApiProvider } from "../providers/kimi_local_web_api/index.js";

export interface VerificationCheck {
  providerIdMatch: boolean;
  modelFamilyMatch: boolean;
  endpointMatch: boolean;
  executionLaneMatch: boolean;
  authMatch: boolean;
  capabilityMatch: boolean;
}

export interface VerificationResult {
  verified: boolean;
  checks: VerificationCheck;
  reasons: string[];
  requestedProvider: string;
  resolvedProvider: string;
  model: string;
  executionLane: "official_api" | "browser_bridge" | "local" | "unknown";
  authSource: string;
}

const KIMI_FAMILY_PROVIDERS = ["kimi_api", "kimi_local_web_api", "kimi_web", "kimi_free_local"] as const;

const PROVIDER_ENDPOINTS: Record<string, string> = {
  kimi_api: "https://api.moonshot.ai/v1",
  kimi_local_web_api: "http://127.0.0.1:9766",
};

const PROVIDER_AUTH_SOURCES: Record<string, string> = {
  kimi_api: "KIMI_API_KEY / MOONSHOT_API_KEY",
  kimi_local_web_api: "browser_session",
};

function recordEvidence(type: string, payload: Record<string, unknown>): void {
  appendEvidenceRecord({
    evidence_id: `verification-${type}-${Date.now()}`,
    trace_id: "provider_verification",
    job_id: "provider_verification",
    type: type as any,
    timestamp: new Date().toISOString(),
    payload,
  }).catch(() => {});
}

function detectExecutionLane(provider: string): "official_api" | "browser_bridge" | "local" | "unknown" {
  if (provider === "kimi_api") return "official_api";
  if (provider === "kimi_local_web_api") return "browser_bridge";
  if (provider === "kimi_web") return "browser_bridge";
  if (provider === "kimi_free_local") return "local";
  if (provider.endsWith("_api")) return "official_api";
  if (provider.endsWith("_web")) return "browser_bridge";
  if (provider === "local") return "local";
  return "unknown";
}

function isKimiEndpoint(provider: string, lane: string): boolean {
  if (lane === "official_api") {
    return provider === "kimi_api";
  }
  if (lane === "browser_bridge") {
    return provider === "kimi_local_web_api" || provider === "kimi_web";
  }
  return false;
}

export const ProviderVerification = {
  verify(
    requestedProvider: string,
    resolvedProvider: string,
    model: string,
    options?: {
      requiresCapability?: string;
      expectedEndpoint?: string;
    }
  ): VerificationResult {
    const checks: VerificationCheck = {
      providerIdMatch: false,
      modelFamilyMatch: false,
      endpointMatch: false,
      executionLaneMatch: false,
      authMatch: false,
      capabilityMatch: false,
    };
    const reasons: string[] = [];

    // 1. Provider ID match: requested should equal resolved
    checks.providerIdMatch = requestedProvider === resolvedProvider;
    if (!checks.providerIdMatch) {
      reasons.push(`provider_id_mismatch: requested="${requestedProvider}" resolved="${resolvedProvider}"`);
    }

    // 2. Model family match: model must belong to provider family
    const isKimiProvider = KIMI_FAMILY_PROVIDERS.includes(requestedProvider as any);
    if (isKimiProvider) {
      checks.modelFamilyMatch = isKimiFamilyModel(model);
      if (!checks.modelFamilyMatch) {
        reasons.push(`model_family_mismatch: "${model}" is not a Kimi-family model for provider "${requestedProvider}"`);
      }
    } else {
      // Non-Kimi provider — model family check passes (other providers have their own validation)
      checks.modelFamilyMatch = true;
    }

    // 3. Endpoint match: verify the endpoint is correct for the provider
    const expectedEndpoint = PROVIDER_ENDPOINTS[resolvedProvider];
    if (expectedEndpoint) {
      if (options?.expectedEndpoint) {
        checks.endpointMatch = options.expectedEndpoint === expectedEndpoint;
      } else {
        checks.endpointMatch = true;
      }
      if (!checks.endpointMatch) {
        reasons.push(`endpoint_mismatch: expected="${expectedEndpoint}" actual="${options?.expectedEndpoint}"`);
      }
    } else {
      checks.endpointMatch = true;
    }

    // 4. Execution lane match: provider type must match execution path
    const lane = detectExecutionLane(resolvedProvider);
    checks.executionLaneMatch = isKimiEndpoint(resolvedProvider, lane);
    if (!checks.executionLaneMatch && isKimiProvider) {
      reasons.push(`execution_lane_mismatch: provider="${resolvedProvider}" lane="${lane}"`);
    }
    if (!isKimiProvider) {
      checks.executionLaneMatch = true;
    }

    // 5. Auth match: verify auth source is available for the provider
    if (resolvedProvider === "kimi_api") {
      checks.authMatch = !!resolveKimiApiKey();
      if (!checks.authMatch) {
        reasons.push("auth_unavailable: KIMI_API_KEY / MOONSHOT_API_KEY not configured");
      }
    } else if (resolvedProvider === "kimi_local_web_api") {
      // Browser bridge auth is session-based, verified at execution time
      checks.authMatch = true;
    } else {
      checks.authMatch = true;
    }

    // 6. Capability match
    if (options?.requiresCapability) {
      if (isKimiProvider) {
        checks.capabilityMatch = isKimiFamilyModel(model);
      } else {
        checks.capabilityMatch = true;
      }
      if (!checks.capabilityMatch) {
        reasons.push(`capability_mismatch: model "${model}" does not support "${options.requiresCapability}"`);
      }
    } else {
      checks.capabilityMatch = true;
    }

    const verified = Object.values(checks).every(Boolean);

    const result: VerificationResult = {
      verified,
      checks,
      reasons,
      requestedProvider,
      resolvedProvider,
      model,
      executionLane: lane,
      authSource: PROVIDER_AUTH_SOURCES[resolvedProvider] || "unknown",
    };

    recordEvidence(verified ? "provider.verification.passed" : "provider.verification.failed", {
      requestedProvider,
      resolvedProvider,
      model,
      lane,
      checks,
      reasons,
    });

    if (!verified) {
      console.error("[provider:verification] FAILED", {
        requestedProvider,
        resolvedProvider,
        model,
        reasons,
      });
    }

    return result;
  },

  verifyKimiExecution(
    provider: string,
    model: string,
    actualEndpoint: string
  ): VerificationResult {
    return ProviderVerification.verify(provider, provider, model, {
      expectedEndpoint: actualEndpoint,
    });
  },

  rejectNonKimiModel(provider: string, model: string): VerificationResult {
    const checks: VerificationCheck = {
      providerIdMatch: true,
      modelFamilyMatch: false,
      endpointMatch: true,
      executionLaneMatch: true,
      authMatch: true,
      capabilityMatch: false,
    };
    const reasons = [
      `non_kimi_model_rejected: model "${model}" cannot be routed through "${provider}"`,
    ];

    const result: VerificationResult = {
      verified: false,
      checks,
      reasons,
      requestedProvider: provider,
      resolvedProvider: provider,
      model,
      executionLane: detectExecutionLane(provider),
      authSource: PROVIDER_AUTH_SOURCES[provider] || "unknown",
    };

    recordEvidence("provider.kimi_k3.unsupported_upstream", {
      requestedModel: model,
      provider,
      reason: "non_kimi_model_rejected",
    });

    return result;
  },
};
