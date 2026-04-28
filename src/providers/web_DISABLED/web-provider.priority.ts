import type { WebProvider } from './web-provider.types';
import { getWebProviderState, isProviderCoolingDown } from './web-provider.state';
import { getRehabPenalty } from './web-provider.rehab';
import { getActiveWebRuntimePolicy } from './web-provider.policy-apply';

const BASE_PRIORITY: Record<WebProvider, number> = {
  openai_web: 100,
  qwen_web: 80,
  deepseek_web: 70,
};

function getReasonPenalty(reason?: string): number {
  if (!reason) return 0;
  const r = reason.toLowerCase();

  if (r.includes('cloudflare') || r.includes('challenge') || r.includes('login')) {
    return 40;
  }
  if (r.includes('timeout')) {
    return 25;
  }
  return 15;
}

export function scoreWebProvider(provider: WebProvider): number {
  const policy = getActiveWebRuntimePolicy();
  const base = BASE_PRIORITY[provider];
  const state = getWebProviderState(provider);

  let score = base;

  score += Math.min(state.consecutiveSuccesses * policy.successBonusPerStep, 24);
  score -= Math.min(state.consecutiveFailures * policy.failurePenaltyPerStep, 36);
  score -= getReasonPenalty(state.lastFailureReason);
  score -= getRehabPenalty(provider);

  if (typeof state.lastLatencyMs === 'number') {
    if (state.lastLatencyMs > 20000) score -= 15;
    else if (state.lastLatencyMs > 10000) score -= 8;
  }

  if (isProviderCoolingDown(provider)) {
    score -= 1000;
  }

  return score;
}

export function sortWebProvidersByPriority(providers: WebProvider[]): WebProvider[] {
  return [...providers].sort((a, b) => scoreWebProvider(b) - scoreWebProvider(a));
}