import type { WebProvider } from './web-provider.types';
import {
  getWebProviderState,
  isProviderCoolingDown,
  getCooldownRemainingMs,
  getRehabStage,
} from './web-provider.state';
import { scoreWebProvider } from './web-provider.priority';
import { sortWebProvidersByPriority } from './web-provider.priority';
import { getWebProviderHealth } from './web-provider.execute';

export interface WebProviderStatus {
  provider: WebProvider;
  score: number;
  ready: boolean;
  cooldownRemainingMs: number | undefined;
  rehabStage: 'probation' | 'recovery' | 'restored' | undefined;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  lastFailureReason?: string;
  lastLatencyMs?: number;
}

export interface WebRuntimeStatus {
  providers: WebProviderStatus[];
  selectedOrder: WebProvider[];
  updatedAt: number;
}

const ALL_PROVIDERS: WebProvider[] = ['openai_web', 'qwen_web', 'deepseek_web'];

export async function getWebRuntimeStatus(): Promise<WebRuntimeStatus> {
  const providers: WebProviderStatus[] = [];
  const now = Date.now();

  for (const provider of ALL_PROVIDERS) {
    const state = getWebProviderState(provider);
    const health = await getWebProviderHealth(provider);
    const score = scoreWebProvider(provider);
    const coolingDown = isProviderCoolingDown(provider, now);
    const cooldownRemaining = coolingDown ? getCooldownRemainingMs(provider, now) : undefined;
    const rehabStage = getRehabStage(provider);

    providers.push({
      provider,
      score,
      ready: health.ready,
      cooldownRemainingMs: cooldownRemaining ?? undefined,
      rehabStage: rehabStage ?? 'restored',
      consecutiveSuccesses: state.consecutiveSuccesses,
      consecutiveFailures: state.consecutiveFailures,
      lastFailureReason: state.lastFailureReason,
      lastLatencyMs: state.lastLatencyMs,
    });
  }

  const sortedProviders = sortWebProvidersByPriority(ALL_PROVIDERS);

  return {
    providers,
    selectedOrder: sortedProviders,
    updatedAt: now,
  };
}