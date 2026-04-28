import type { WebProvider } from './web-provider.types';
import { getWebProviderState, isProviderCoolingDown, type RehabStage } from './web-provider.state';
import { scoreWebProvider } from './web-provider.priority';

export interface WebProviderExplain {
  provider: WebProvider;
  score: number;
  coolingDown: boolean;
  cooldownRemainingMs: number;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  lastFailureReason?: string;
  lastLatencyMs?: number;
  rehabStage?: RehabStage;
  explanation: string[];
}

export function explainWebProvider(provider: WebProvider, now = Date.now()): WebProviderExplain {
  const state = getWebProviderState(provider);
  const coolingDown = isProviderCoolingDown(provider, now);
  const cooldownRemainingMs =
    state.cooldownUntil && state.cooldownUntil > now
      ? state.cooldownUntil - now
      : 0;

  const explanation: string[] = [];

  explanation.push(`base_score=${scoreWebProvider(provider)}`);

  if (coolingDown) {
    explanation.push(`cooldown_active=${cooldownRemainingMs}ms`);
  }

  if (state.rehabStage && state.rehabStage !== 'restored') {
    explanation.push(`rehab_stage=${state.rehabStage}`);
  }

  if (state.consecutiveSuccesses > 0) {
    explanation.push(`success_streak=${state.consecutiveSuccesses}`);
  }

  if (state.consecutiveFailures > 0) {
    explanation.push(`failure_streak=${state.consecutiveFailures}`);
  }

  if (state.lastFailureReason) {
    explanation.push(`last_failure=${state.lastFailureReason}`);
  }

  if (typeof state.lastLatencyMs === 'number') {
    explanation.push(`last_latency_ms=${state.lastLatencyMs}`);
  }

  return {
    provider,
    score: scoreWebProvider(provider),
    coolingDown,
    cooldownRemainingMs,
    consecutiveSuccesses: state.consecutiveSuccesses,
    consecutiveFailures: state.consecutiveFailures,
    lastFailureReason: state.lastFailureReason,
    lastLatencyMs: state.lastLatencyMs,
    rehabStage: state.rehabStage,
    explanation,
  };
}