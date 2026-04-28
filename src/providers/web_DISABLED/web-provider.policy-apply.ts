import type { WebRuntimePolicyName, WebRuntimePolicy } from './web-provider.policy';

const DEFAULT_POLICY: WebRuntimePolicy = {
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
};

let activePolicy: WebRuntimePolicyName = 'balanced';

export function getActiveWebRuntimePolicy(): WebRuntimePolicy {
  return DEFAULT_POLICY;
}

export function setActiveWebRuntimePolicy(name: WebRuntimePolicyName): WebRuntimePolicy {
  activePolicy = name;
  return DEFAULT_POLICY;
}

export function listWebRuntimePolicies(): WebRuntimePolicy[] {
  return [DEFAULT_POLICY];
}
