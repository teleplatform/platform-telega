import type { WebProvider } from './web-provider.types';
import { getWebProviderState } from './web-provider.state';
import { getActiveWebRuntimePolicy } from './web-provider.policy-apply';

export function getRehabPenalty(provider: WebProvider): number {
  const state = getWebProviderState(provider);
  const policy = getActiveWebRuntimePolicy();

  switch (state.rehabStage) {
    case 'probation':
      return policy.rehabPenaltyProbation;
    case 'recovery':
      return policy.rehabPenaltyRecovery;
    case 'restored':
    default:
      return 0;
  }
}

export function isInRehab(provider: WebProvider): boolean {
  const stage = getWebProviderState(provider).rehabStage;
  return stage === 'probation' || stage === 'recovery';
}