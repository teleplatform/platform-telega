/**
 * Voice Core Compatibility Contract Layer v9.7
 *
 * First-class entity: VoiceCoreCompatibilityContract
 *
 * This layer answers:
 *   - "What invariants must this core version preserve?"
 *   - "Has the contract been verified for this version?"
 *   - "Which guarantees are explicitly documented?"
 *
 * This layer does NOT:
 *   - create snapshots (delegated to V9.4)
 *   - validate dual-core behavior (delegated to V9.8)
 *
 * RULE: NO CORE ACTIVATION WITHOUT EXPLICIT COMPATIBILITY CONTRACT
 */

import type { VoiceCoreSnapshot } from "./voiceCoreSnapshot.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceCoreInvariant =
  | "audit_integrity"
  | "human_control"
  | "mission_continuity"
  | "policy_enforcement"
  | "rollback_capability"
  | "constitutional_identity"
  | "governance_boundedness";

export type VoiceContractVerificationStatus =
  | "not_started"
  | "in_progress"
  | "verified"
  | "failed"
  | "waived";

export interface VoiceInvariantVerification {
  invariant: VoiceCoreInvariant;
  verified: boolean;
  verificationMethod: "automated" | "manual" | "hybrid";
  notes?: string;
  verifiedAt?: number;
}

export interface VoiceCoreCompatibilityContract {
  contractId: string;

  snapshotId: string;
  version: string;

  invariants: VoiceInvariantVerification[];

  status: VoiceContractVerificationStatus;

  verified: boolean;
  verifiedAt?: number;
  verifiedBy?: string;

  // Explicit guarantees
  guarantees: Array<{
    guarantee: string;
    scope: "local" | "multi_domain" | "core_global";
    enforced: boolean;
  }>;

  // Known limitations
  knownLimitations: Array<{
    limitation: string;
    severity: "low" | "medium" | "high" | "critical";
    mitigation?: string;
  }>;

  createdAt: number;
}

export type VoiceContractValidationError =
  | "no_invariants_defined"
  | "invariant_not_verified"
  | "invalid_verification_status"
  | "critical_limitation_not_addressed";

// ============================================================================
// ID generation
// ============================================================================

function generateContractId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_contract_${timestamp}_${random}`;
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

const ALL_CORE_INVARIANTS: VoiceCoreInvariant[] = [
  "audit_integrity",
  "human_control",
  "mission_continuity",
  "policy_enforcement",
  "rollback_capability",
  "constitutional_identity",
  "governance_boundedness",
];

const VALID_VERIFICATION_STATUSES: VoiceContractVerificationStatus[] = [
  "not_started",
  "in_progress",
  "verified",
  "failed",
  "waived",
];

export function validateContract(
  contract: Partial<VoiceCoreCompatibilityContract>,
): VoiceContractValidationError[] {
  const errors: VoiceContractValidationError[] = [];

  if (
    contract.invariants &&
    contract.invariants.length === 0
  ) {
    errors.push("no_invariants_defined");
  }

  // Check that all invariants have verification results
  if (contract.invariants) {
    const unverified = contract.invariants.filter(
      (inv) => !inv.verified && contract.status !== "not_started",
    );
    if (unverified.length > 0 && contract.status === "verified") {
      errors.push("invariant_not_verified");
    }
  }

  if (
    contract.status &&
    !VALID_VERIFICATION_STATUSES.includes(contract.status)
  ) {
    errors.push("invalid_verification_status");
  }

  // Critical limitations must have mitigation
  if (contract.knownLimitations) {
    const criticalWithoutMitigation = contract.knownLimitations.filter(
      (l) => l.severity === "critical" && !l.mitigation,
    );
    if (criticalWithoutMitigation.length > 0) {
      errors.push("critical_limitation_not_addressed");
    }
  }

  return errors;
}

// ============================================================================
// Contract creation
// ============================================================================

export interface VoiceCreateContractInput {
  snapshot: VoiceCoreSnapshot;
  requiredInvariants?: VoiceCoreInvariant[];
  guarantees?: VoiceCoreCompatibilityContract["guarantees"];
  knownLimitations?: VoiceCoreCompatibilityContract["knownLimitations"];
}

/**
 * Create a compatibility contract for a core snapshot.
 * Pure function — defines what invariants must be preserved.
 */
export function createCompatibilityContract(
  input: VoiceCreateContractInput,
): {
  contract: VoiceCoreCompatibilityContract;
  validationErrors: VoiceContractValidationError[];
} {
  const invariants = (input.requiredInvariants ?? ALL_CORE_INVARIANTS).map(
    (inv) => ({
      invariant: inv,
      verified: false,
      verificationMethod: "automated" as const,
    }),
  );

  const contract: VoiceCoreCompatibilityContract = {
    contractId: generateContractId(),
    snapshotId: input.snapshot.snapshotId,
    version: input.snapshot.version,
    invariants,
    status: "not_started",
    verified: false,
    guarantees: input.guarantees ?? [],
    knownLimitations: input.knownLimitations ?? [],
    createdAt: Date.now(),
  };

  const validationErrors = validateContract(contract);

  return { contract, validationErrors };
}

// ============================================================================
// Invariant verification
// ============================================================================

/**
 * Verify a single invariant.
 */
export function verifyInvariant(
  contract: VoiceCoreCompatibilityContract,
  invariant: VoiceCoreInvariant,
  verified: boolean,
  method: "automated" | "manual" | "hybrid",
  notes?: string,
): VoiceCoreCompatibilityContract {
  const updatedInvariants = contract.invariants.map((inv) =>
    inv.invariant === invariant
      ? {
          ...inv,
          verified,
          verificationMethod: method,
          notes: notes ?? inv.notes,
          verifiedAt: Date.now(),
        }
      : inv,
  );

  const allVerified = updatedInvariants.every((inv) => inv.verified);
  const anyFailed = updatedInvariants.some(
    (inv) => !inv.verified && inv.verificationMethod !== "automated",
  );

  const status: VoiceContractVerificationStatus = allVerified
    ? "verified"
    : anyFailed
      ? "failed"
      : "in_progress";

  return {
    ...contract,
    invariants: updatedInvariants,
    status,
    verified: allVerified,
    verifiedAt: allVerified ? Date.now() : undefined,
  };
}

/**
 * Verify all invariants at once.
 */
export function verifyAllInvariants(
  contract: VoiceCoreCompatibilityContract,
  method: "automated" | "manual" | "hybrid" = "automated",
): VoiceCoreCompatibilityContract {
  const updatedInvariants = contract.invariants.map((inv) => ({
    ...inv,
    verified: true,
    verificationMethod: method,
    verifiedAt: Date.now(),
  }));

  return {
    ...contract,
    invariants: updatedInvariants,
    status: "verified",
    verified: true,
    verifiedAt: Date.now(),
  };
}

// ============================================================================
// Contract activation gate
// ============================================================================

/**
 * Check if a contract allows core activation.
 * RULE: NO CORE ACTIVATION WITHOUT EXPLICIT COMPATIBILITY CONTRACT
 */
export function canActivateWithContract(
  contract: VoiceCoreCompatibilityContract,
): { allowed: boolean; reason: string; blockers: string[] } {
  const blockers: string[] = [];

  if (!contract.verified) {
    blockers.push(
      `Contract not verified: status is "${contract.status}". All invariants must be verified.`,
    );
  }

  const unverifiedInvariants = contract.invariants.filter(
    (inv) => !inv.verified,
  );
  if (unverifiedInvariants.length > 0) {
    blockers.push(
      `Unverified invariants: ${unverifiedInvariants.map((i) => i.invariant).join(", ")}`,
    );
  }

  const criticalLimitations = contract.knownLimitations.filter(
    (l) => l.severity === "critical" && !l.mitigation,
  );
  if (criticalLimitations.length > 0) {
    blockers.push(
      `Critical limitations without mitigation: ${criticalLimitations.map((l) => l.limitation).join(", ")}`,
    );
  }

  return {
    allowed: blockers.length === 0,
    reason:
      blockers.length === 0
        ? `Compatibility contract verified for ${contract.version}`
        : `Core activation blocked: ${blockers.join("; ")}`,
    blockers,
  };
}

// ============================================================================
// Contract registry
// ============================================================================

export interface VoiceContractRegistry {
  contracts: Map<string, VoiceCoreCompatibilityContract>;
  maxContracts: number;
}

const DEFAULT_CONTRACT_MAX = 50;

let _contractRegistry: VoiceContractRegistry = {
  contracts: new Map(),
  maxContracts: DEFAULT_CONTRACT_MAX,
};

export function registerContract(
  contract: VoiceCoreCompatibilityContract,
): void {
  if (_contractRegistry.contracts.size >= _contractRegistry.maxContracts) {
    throw new Error(
      `Contract registry full (max ${_contractRegistry.maxContracts}). Cannot register ${contract.contractId}`,
    );
  }
  _contractRegistry.contracts.set(contract.contractId, contract);
}

export function getContract(
  contractId: string,
): VoiceCoreCompatibilityContract | undefined {
  return _contractRegistry.contracts.get(contractId);
}

export function getContractForSnapshot(
  snapshotId: string,
): VoiceCoreCompatibilityContract | undefined {
  return Array.from(_contractRegistry.contracts.values()).find(
    (c) => c.snapshotId === snapshotId,
  );
}

export function getContractForVersion(
  version: string,
): VoiceCoreCompatibilityContract | undefined {
  return Array.from(_contractRegistry.contracts.values()).find(
    (c) => c.version === version,
  );
}

export function getVerifiedContracts(): VoiceCoreCompatibilityContract[] {
  return Array.from(_contractRegistry.contracts.values()).filter(
    (c) => c.verified,
  );
}

export function getAllContracts(): VoiceCoreCompatibilityContract[] {
  return Array.from(_contractRegistry.contracts.values())
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function removeContract(contractId: string): boolean {
  return _contractRegistry.contracts.delete(contractId);
}

export function clearContractRegistry(): void {
  _contractRegistry = {
    contracts: new Map(),
    maxContracts: DEFAULT_CONTRACT_MAX,
  };
}

export function setContractRegistryForTest(
  registry: VoiceContractRegistry,
): void {
  _contractRegistry = registry;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceCompatibilityContract(
  contract: VoiceCoreCompatibilityContract,
): string {
  const statusEmoji: Record<VoiceContractVerificationStatus, string> = {
    not_started: "⏸️",
    in_progress: "⏳",
    verified: "✅",
    failed: "❌",
    waived: "⚠️",
  };

  const checkEmoji = (verified: boolean) => (verified ? "✅" : "❌");

  const lines = [
    `📜 Voice Core Compatibility Contract`,
    `• contract ID: ${contract.contractId}`,
    `• version: ${contract.version}`,
    `• status: ${statusEmoji[contract.status]} ${contract.status}`,
    `• verified: ${contract.verified ? `yes (${contract.verifiedBy ?? "system"})` : "no"}`,
    `--- Invariant Verifications (${contract.invariants.length}) ---`,
  ];

  for (const inv of contract.invariants) {
    lines.push(
      `  ${checkEmoji(inv.verified)} ${inv.invariant} [${inv.verificationMethod}]${inv.notes ? `: ${inv.notes}` : ""}`,
    );
  }

  if (contract.guarantees.length > 0) {
    lines.push(`--- Guarantees (${contract.guarantees.length}) ---`);
    for (const g of contract.guarantees.slice(0, 5)) {
      lines.push(`  ${g.enforced ? "✅" : "⏸️"} ${g.guarantee} [${g.scope}]`);
    }
  }

  if (contract.knownLimitations.length > 0) {
    lines.push(
      `--- Known Limitations (${contract.knownLimitations.length}) ---`,
    );
    for (const l of contract.knownLimitations.slice(0, 5)) {
      lines.push(
        `  ⚠️ ${l.limitation} [${l.severity}]${l.mitigation ? ` → ${l.mitigation}` : ""}`,
      );
    }
  }

  lines.push(`• created at: ${new Date(contract.createdAt).toISOString()}`);

  return lines.filter(Boolean).join("\n");
}
