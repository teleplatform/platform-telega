import type { ProviderId } from "./provider-resolution.js";

export type RuntimeRole = "creator" | "user";
export type ExecutionPath = "bridge" | "api";
export type UserIntentPreference = "fast" | "quality" | "cheap" | "local_only" | "no_fallback";

export type ProviderKind = ProviderId;

export type ProviderResolutionParams = {
  role: RuntimeRole;
  preferredProvider?: ProviderKind | null;
  bridgeEnabled?: boolean;
  bridgeSessionReady?: boolean;
  allowApiFallback?: boolean;
};

export type ProviderResolutionResult = {
  role: RuntimeRole;
  intendedPath: ExecutionPath;
  actualPath: ExecutionPath;
  primaryProvider: ProviderKind;
  candidateProviders: ProviderKind[];
  fallbackUsed: boolean;
  reason?: string;
};

const BRIDGE_PROVIDERS: ProviderKind[] = [
  "chatgpt_web",
  "qwen_web",
  "deepseek_web",
];

const API_PROVIDERS: ProviderKind[] = [
  "openai_api",
  "qwen_api",
  "deepseek_api",
];

const LOCAL_FALLBACK: ProviderKind = "local";

export function isBridgeProvider(provider: ProviderKind): boolean {
  return BRIDGE_PROVIDERS.includes(provider);
}

export function isApiProvider(provider: ProviderKind): boolean {
  return API_PROVIDERS.includes(provider);
}

export function resolveExecutionPath(role: RuntimeRole): ExecutionPath {
  return role === "creator" ? "bridge" : "api";
}

export function normalizePreferredProvider(
  provider?: ProviderKind | null
): ProviderKind | null {
  if (!provider) return null;
  return provider;
}

function buildBridgeCandidates(
  preferredProvider?: ProviderKind | null,
  allowApiFallback = true
): ProviderKind[] {
  const candidates: ProviderKind[] = [];

  if (preferredProvider && isBridgeProvider(preferredProvider)) {
    candidates.push(preferredProvider);
  }

  for (const provider of BRIDGE_PROVIDERS) {
    if (!candidates.includes(provider)) {
      candidates.push(provider);
    }
  }

  if (allowApiFallback) {
    for (const provider of API_PROVIDERS) {
      if (!candidates.includes(provider)) {
        candidates.push(provider);
      }
    }
  }

  if (!candidates.includes(LOCAL_FALLBACK)) {
    candidates.push(LOCAL_FALLBACK);
  }

  return candidates;
}

function buildApiCandidates(
  preferredProvider?: ProviderKind | null
): ProviderKind[] {
  const candidates: ProviderKind[] = [];

  if (preferredProvider && isApiProvider(preferredProvider)) {
    candidates.push(preferredProvider);
  }

  for (const provider of API_PROVIDERS) {
    if (!candidates.includes(provider)) {
      candidates.push(provider);
    }
  }

  if (!candidates.includes(LOCAL_FALLBACK)) {
    candidates.push(LOCAL_FALLBACK);
  }

  return candidates;
}

export function rankProviders(
  params: ProviderResolutionParams
): ProviderResolutionResult {
  const role = params.role;
  const intendedPath = resolveExecutionPath(role);
  const preferredProvider = normalizePreferredProvider(params.preferredProvider);
  const allowApiFallback = params.allowApiFallback ?? true;

  if (role === "user") {
    const candidateProviders = buildApiCandidates(preferredProvider);
    return {
      role,
      intendedPath: "api",
      actualPath: "api",
      primaryProvider: candidateProviders[0],
      candidateProviders,
      fallbackUsed: false,
    };
  }

  if (params.bridgeEnabled === false) {
    const candidateProviders = buildApiCandidates(
      isApiProvider(preferredProvider ?? "openai_api")
        ? preferredProvider
        : "openai_api"
    );

    return {
      role,
      intendedPath: "bridge",
      actualPath: "api",
      primaryProvider: candidateProviders[0],
      candidateProviders,
      fallbackUsed: true,
      reason: "bridge_disabled",
    };
  }

  if (params.bridgeSessionReady === false) {
    const candidateProviders = buildApiCandidates(
      isApiProvider(preferredProvider ?? "openai_api")
        ? preferredProvider
        : "openai_api"
    );

    return {
      role,
      intendedPath: "bridge",
      actualPath: "api",
      primaryProvider: candidateProviders[0],
      candidateProviders,
      fallbackUsed: true,
      reason: "bridge_session_not_ready",
    };
  }

  const candidateProviders = buildBridgeCandidates(
    preferredProvider,
    allowApiFallback
  );

  return {
    role,
    intendedPath: "bridge",
    actualPath: "bridge",
    primaryProvider: candidateProviders[0],
    candidateProviders,
    fallbackUsed: false,
  };
}

export function resolveTimeoutFallback(
  previous: ProviderResolutionResult
): ProviderResolutionResult {
  const next = previous.candidateProviders.find(
    (provider) => provider !== previous.primaryProvider
  );

  if (!next) {
    return {
      ...previous,
      fallbackUsed: true,
      reason: previous.reason ?? "no_fallback_available",
    };
  }

  return {
    ...previous,
    actualPath: isBridgeProvider(next) ? "bridge" : "api",
    primaryProvider: next,
    candidateProviders: previous.candidateProviders.filter(
      (provider) => provider !== previous.primaryProvider
    ),
    fallbackUsed: true,
    reason: previous.reason ?? "provider_timeout",
  };
}
