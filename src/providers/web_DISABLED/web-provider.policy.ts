export type WebRuntimePolicyName = 'safe' | 'balanced' | 'aggressive_recovery';

export interface WebRuntimePolicy {
  name: WebRuntimePolicyName;
  description: string;
  cloudflareCooldownMs: number;
  timeoutCooldownMs: number;
  otherFailureCooldownMs: number;
  rehabPenaltyProbation: number;
  rehabPenaltyRecovery: number;
  maxRetriesPerProvider: number;
  successBonusPerStep: number;
  failurePenaltyPerStep: number;
}

export const WEB_RUNTIME_POLICIES: Record<WebRuntimePolicyName, WebRuntimePolicy> = {
  safe: {
    name: 'safe',
    description: 'Conservative behavior - longer cooldowns, slower recovery, prefers stability',
    cloudflareCooldownMs: 10 * 60 * 1000,
    timeoutCooldownMs: 5 * 60 * 1000,
    otherFailureCooldownMs: 2 * 60 * 1000,
    rehabPenaltyProbation: 50,
    rehabPenaltyRecovery: 25,
    maxRetriesPerProvider: 0,
    successBonusPerStep: 4,
    failurePenaltyPerStep: 20,
  },
  balanced: {
    name: 'balanced',
    description: 'Default behavior - moderate cooldowns, normal recovery, balanced scoring',
    cloudflareCooldownMs: 5 * 60 * 1000,
    timeoutCooldownMs: 2 * 60 * 1000,
    otherFailureCooldownMs: 30 * 1000,
    rehabPenaltyProbation: 30,
    rehabPenaltyRecovery: 12,
    maxRetriesPerProvider: 1,
    successBonusPerStep: 8,
    failurePenaltyPerStep: 12,
  },
  aggressive_recovery: {
    name: 'aggressive_recovery',
    description: 'Fast recovery - short cooldowns, quick provider return, more retries',
    cloudflareCooldownMs: 2 * 60 * 1000,
    timeoutCooldownMs: 60 * 1000,
    otherFailureCooldownMs: 10 * 1000,
    rehabPenaltyProbation: 15,
    rehabPenaltyRecovery: 5,
    maxRetriesPerProvider: 2,
    successBonusPerStep: 12,
    failurePenaltyPerStep: 6,
  },
};

export function getPolicy(name: WebRuntimePolicyName): WebRuntimePolicy {
  return WEB_RUNTIME_POLICIES[name] || WEB_RUNTIME_POLICIES.balanced;
}

export function listPolicies(): WebRuntimePolicy[] {
  return Object.values(WEB_RUNTIME_POLICIES);
}