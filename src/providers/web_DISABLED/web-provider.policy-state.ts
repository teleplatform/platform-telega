import type { WebRuntimePolicyName } from './web-provider.policy';

let activePolicyName: WebRuntimePolicyName = 'balanced';

export function getActivePolicyName(): WebRuntimePolicyName {
  return activePolicyName;
}

export function setActivePolicyName(name: WebRuntimePolicyName): void {
  activePolicyName = name;
}
