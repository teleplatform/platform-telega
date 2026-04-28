/**
 * Voice Domain Segmentation & Isolated Governance Layer v7.6
 *
 * First-class entity: VoiceDomain
 *
 * This layer answers:
 *   - "What are the isolated governance domains within the system?"
 *   - "What is the risk profile and isolation level of each domain?"
 *   - "How are domains segmented to prevent cascade failures?"
 *
 * This layer does NOT:
 *   - coordinate between domains (delegated to V7.7)
 *   - orchestrate global coherence (delegated to V7.8)
 *   - manage missions across domains (delegated to V7.9+)
 *
 * RULE: FAILURE IN ONE DOMAIN MUST NOT CASCADE TO OTHERS
 */

// ============================================================================
// Domain model
// ============================================================================

export type VoiceDomainType =
  | "execution"
  | "adaptation"
  | "strategy"
  | "review"
  | "safety";

export type VoiceDomainIsolationLevel =
  | "strict"
  | "moderate"
  | "shared";

export type VoiceDomainRiskProfile =
  | "low"
  | "medium"
  | "high"
  | "critical";

export interface VoiceDomain {
  domainId: string;

  domainType: VoiceDomainType;

  isolationLevel: VoiceDomainIsolationLevel;

  riskProfile: VoiceDomainRiskProfile;

  activePolicies: string[]; // policy IDs applied to this domain

  lastUpdatedAt: number;

  // Metadata
  description: string;
  enabled: boolean;

  // Health tracking
  healthScore: number; // 0..100
  failureCount: number;
  lastFailureAt?: number;
}

export type VoiceDomainValidationError =
  | "invalid_domain_type"
  | "invalid_isolation_level"
  | "invalid_risk_profile"
  | "health_score_out_of_range"
  | "negative_failure_count"
  | "missing_description";

// ============================================================================
// ID generation
// ============================================================================

function generateDomainId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_domain_${timestamp}_${random}`;
}

function cryptoRandomHex(bytes: number): string {
  try {
    const { randomBytes } = require("node:crypto");
    return randomBytes(bytes).toString("hex");
  } catch {
    return Math.random().toString(16).slice(2, 2 + bytes * 2);
  }
}

// ============================================================================
// Validation
// ============================================================================

const VALID_DOMAIN_TYPES: VoiceDomainType[] = [
  "execution",
  "adaptation",
  "strategy",
  "review",
  "safety",
];

const VALID_ISOLATION_LEVELS: VoiceDomainIsolationLevel[] = [
  "strict",
  "moderate",
  "shared",
];

const VALID_RISK_PROFILES: VoiceDomainRiskProfile[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export function validateVoiceDomain(
  domain: Partial<VoiceDomain>,
): VoiceDomainValidationError[] {
  const errors: VoiceDomainValidationError[] = [];

  if (domain.domainType && !VALID_DOMAIN_TYPES.includes(domain.domainType)) {
    errors.push("invalid_domain_type");
  }

  if (
    domain.isolationLevel &&
    !VALID_ISOLATION_LEVELS.includes(domain.isolationLevel)
  ) {
    errors.push("invalid_isolation_level");
  }

  if (domain.riskProfile && !VALID_RISK_PROFILES.includes(domain.riskProfile)) {
    errors.push("invalid_risk_profile");
  }

  if (
    domain.healthScore !== undefined &&
    (domain.healthScore < 0 || domain.healthScore > 100)
  ) {
    errors.push("health_score_out_of_range");
  }

  if (domain.failureCount !== undefined && domain.failureCount < 0) {
    errors.push("negative_failure_count");
  }

  if (domain.description !== undefined && domain.description.trim().length === 0) {
    errors.push("missing_description");
  }

  return errors;
}

// ============================================================================
// Default domain profiles
// ============================================================================

/**
 * Default configuration for each domain type.
 * These profiles enforce proper isolation and risk defaults.
 */
const DEFAULT_DOMAIN_PROFILES: Record<
  VoiceDomainType,
  {
    isolationLevel: VoiceDomainIsolationLevel;
    riskProfile: VoiceDomainRiskProfile;
    description: string;
  }
> = {
  safety: {
    isolationLevel: "strict",
    riskProfile: "critical",
    description: "Safety governance domain — final authority on all decisions",
  },

  review: {
    isolationLevel: "strict",
    riskProfile: "high",
    description: "Review and validation domain — ensures decision quality",
  },

  strategy: {
    isolationLevel: "moderate",
    riskProfile: "medium",
    description: "Strategy control domain — manages adaptation strategies",
  },

  adaptation: {
    isolationLevel: "moderate",
    riskProfile: "medium",
    description: "Adaptation engine domain — manages system adaptations",
  },

  execution: {
    isolationLevel: "shared",
    riskProfile: "low",
    description: "Execution layer domain — handles actual task execution",
  },
};

// ============================================================================
// Core domain creation
// ============================================================================

export interface VoiceDomainInput {
  domainType: VoiceDomainType;
  description?: string;
  activePolicies?: string[];

  /** Override default isolation level. */
  customIsolationLevel?: VoiceDomainIsolationLevel;

  /** Override default risk profile. */
  customRiskProfile?: VoiceDomainRiskProfile;
}

/**
 * Create a new voice governance domain.
 * Pure function — applies defaults and validates.
 */
export function createVoiceDomain(input: VoiceDomainInput): {
  domain: VoiceDomain;
  validationErrors: VoiceDomainValidationError[];
} {
  const profile = DEFAULT_DOMAIN_PROFILES[input.domainType];

  const domain: VoiceDomain = {
    domainId: generateDomainId(),
    domainType: input.domainType,
    isolationLevel: input.customIsolationLevel ?? profile.isolationLevel,
    riskProfile: input.customRiskProfile ?? profile.riskProfile,
    activePolicies: input.activePolicies ?? [],
    lastUpdatedAt: Date.now(),
    description: input.description ?? profile.description,
    enabled: true,
    healthScore: 100,
    failureCount: 0,
  };

  const validationErrors = validateVoiceDomain(domain);

  return { domain, validationErrors };
}

// ============================================================================
// Domain lifecycle management
// ============================================================================

export function recordDomainFailure(
  domain: VoiceDomain,
): VoiceDomain {
  const now = Date.now();
  const newFailureCount = domain.failureCount + 1;

  // Health score degrades with failures (exponential decay)
  const healthDecay = Math.min(50, newFailureCount * 5 * Math.log2(newFailureCount + 1));
  const newHealthScore = Math.max(0, domain.healthScore - healthDecay);

  return {
    ...domain,
    failureCount: newFailureCount,
    healthScore: Math.round(newHealthScore),
    lastFailureAt: now,
    lastUpdatedAt: now,
  };
}

export function recoverDomain(
  domain: VoiceDomain,
): VoiceDomain {
  const now = Date.now();

  return {
    ...domain,
    healthScore: Math.min(100, domain.healthScore + 20),
    failureCount: Math.max(0, domain.failureCount - 1),
    lastUpdatedAt: now,
  };
}

export function updateDomainPolicies(
  domain: VoiceDomain,
  policyIds: string[],
): VoiceDomain {
  return {
    ...domain,
    activePolicies: policyIds,
    lastUpdatedAt: Date.now(),
  };
}

export function disableDomain(
  domain: VoiceDomain,
  reason: string,
): VoiceDomain {
  return {
    ...domain,
    enabled: false,
    lastUpdatedAt: Date.now(),
    description: `${domain.description} | DISABLED: ${reason}`,
  };
}

export function enableDomain(
  domain: VoiceDomain,
): VoiceDomain {
  return {
    ...domain,
    enabled: true,
    lastUpdatedAt: Date.now(),
  };
}

// ============================================================================
// Domain registry
// ============================================================================

export interface VoiceDomainRegistry {
  domains: Map<string, VoiceDomain>;
  maxDomains: number;
}

const DEFAULT_MAX_DOMAINS = 20;

let _domainRegistry: VoiceDomainRegistry = {
  domains: new Map(),
  maxDomains: DEFAULT_MAX_DOMAINS,
};

export function getVoiceDomainRegistry(): VoiceDomainRegistry {
  return {
    domains: new Map(_domainRegistry.domains),
    maxDomains: _domainRegistry.maxDomains,
  };
}

export function registerVoiceDomain(domain: VoiceDomain): void {
  if (_domainRegistry.domains.size >= _domainRegistry.maxDomains) {
    throw new Error(
      `Domain registry full (max ${_domainRegistry.maxDomains}). Cannot register ${domain.domainId}`,
    );
  }
  _domainRegistry.domains.set(domain.domainId, domain);
}

export function getVoiceDomain(domainId: string): VoiceDomain | undefined {
  return _domainRegistry.domains.get(domainId);
}

export function getAllVoiceDomains(): VoiceDomain[] {
  return Array.from(_domainRegistry.domains.values());
}

export function getVoiceDomainsByType(
  type: VoiceDomainType,
): VoiceDomain[] {
  return Array.from(_domainRegistry.domains.values()).filter(
    (d) => d.domainType === type,
  );
}

export function removeVoiceDomain(domainId: string): boolean {
  return _domainRegistry.domains.delete(domainId);
}

export function clearVoiceDomainRegistry(): void {
  _domainRegistry = {
    domains: new Map(),
    maxDomains: DEFAULT_MAX_DOMAINS,
  };
}

export function setVoiceDomainRegistryForTest(registry: VoiceDomainRegistry): void {
  _domainRegistry = registry;
}

// ============================================================================
// Isolation analysis
// ============================================================================

/**
 * Analyze the isolation boundaries between two domains.
 * Returns the isolation boundary strength (0 = no isolation, 1 = complete isolation).
 */
export function analyzeDomainIsolation(
  domainA: VoiceDomain,
  domainB: VoiceDomain,
): {
  isolationStrength: number; // 0..1
  cascadeRisk: "none" | "low" | "medium" | "high";
  explanation: string;
} {
  const isolationScores: Record<VoiceDomainIsolationLevel, number> = {
    strict: 1,
    moderate: 0.6,
    shared: 0.3,
  };

  const strengthA = isolationScores[domainA.isolationLevel];
  const strengthB = isolationScores[domainB.isolationLevel];

  // Combined isolation strength is the minimum of both
  const combinedStrength = Math.min(strengthA, strengthB);

  // Cascade risk assessment
  let cascadeRisk: "none" | "low" | "medium" | "high";
  if (combinedStrength >= 0.9) cascadeRisk = "none";
  else if (combinedStrength >= 0.6) cascadeRisk = "low";
  else if (combinedStrength >= 0.3) cascadeRisk = "medium";
  else cascadeRisk = "high";

  const explanation = `Domain A (${domainA.domainType}, ${domainA.isolationLevel}) ↔ Domain B (${domainB.domainType}, ${domainB.isolationLevel}): isolation strength=${combinedStrength.toFixed(2)}, cascade risk=${cascadeRisk}`;

  return {
    isolationStrength: combinedStrength,
    cascadeRisk,
    explanation,
  };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceDomain(domain: VoiceDomain): string {
  return [
    `🏛️ Voice Domain`,
    `• domain ID: ${domain.domainId}`,
    `• type: ${domain.domainType}`,
    `• isolation: ${domain.isolationLevel}`,
    `• risk profile: ${domain.riskProfile}`,
    `• health: ${domain.healthScore}%`,
    `• failures: ${domain.failureCount}`,
    `• enabled: ${domain.enabled ? "YES" : "NO"}`,
    `• active policies: ${domain.activePolicies.length} (${domain.activePolicies.join(", ") || "none"})`,
    `• description: ${domain.description}`,
    `• last updated: ${new Date(domain.lastUpdatedAt).toISOString()}`,
    domain.lastFailureAt
      ? `• last failure: ${new Date(domain.lastFailureAt).toISOString()}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatVoiceDomainRegistry(registry: VoiceDomainRegistry): string {
  const lines = [
    `🏛️ Voice Domain Registry (${registry.domains.size}/${registry.maxDomains} domains)`,
  ];

  for (const domain of registry.domains.values()) {
    const status = domain.enabled ? "✅" : "❌";
    lines.push(
      `  ${status} ${domain.domainType} [${domain.isolationLevel}] risk=${domain.riskProfile} health=${domain.healthScore}%`,
    );
  }

  return lines.join("\n");
}
