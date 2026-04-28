import type { WebProvider } from './web-provider.types';

export type RehabStage = 'probation' | 'recovery' | 'restored';

export interface WebProviderRuntimeState {
  provider: WebProvider;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureReason?: string;
  lastLatencyMs?: number;
  lastOkAt?: number;
  lastFailAt?: number;
  cooldownUntil?: number;
  rehabStage?: RehabStage;
  rehabSince?: number;
}

const ALL_PROVIDERS: WebProvider[] = ['deepseek_web'];

const stateStore = new Map<WebProvider, WebProviderRuntimeState>();

function getDefaultState(provider: WebProvider): WebProviderRuntimeState {
  return {
    provider,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    rehabStage: 'restored',
  };
}

export function getWebProviderState(provider: WebProvider): WebProviderRuntimeState {
  return stateStore.get(provider) ?? getDefaultState(provider);
}

export function setWebProviderState(state: WebProviderRuntimeState): void {
  stateStore.set(state.provider, state);
}

export function isProviderCoolingDown(provider: WebProvider, now = Date.now()): boolean {
  const state = getWebProviderState(provider);
  return typeof state.cooldownUntil === 'number' && state.cooldownUntil > now;
}

export function markWebProviderSuccess(
  provider: WebProvider,
  latencyMs?: number
): WebProviderRuntimeState {
  const prev = getWebProviderState(provider);
  const next: WebProviderRuntimeState = {
    ...prev,
    consecutiveFailures: 0,
    consecutiveSuccesses: prev.consecutiveSuccesses + 1,
    lastFailureReason: undefined,
    lastLatencyMs: latencyMs,
    lastOkAt: Date.now(),
    cooldownUntil: undefined,
  };
  setWebProviderState(next);
  return next;
}

export function markWebProviderFailure(
  provider: WebProvider,
  reason?: string,
  cooldownMs?: number
): WebProviderRuntimeState {
  const prev = getWebProviderState(provider);
  const now = Date.now();

  const next: WebProviderRuntimeState = {
    ...prev,
    consecutiveFailures: prev.consecutiveFailures + 1,
    consecutiveSuccesses: 0,
    lastFailureReason: reason,
    lastFailAt: now,
    cooldownUntil: cooldownMs ? now + cooldownMs : prev.cooldownUntil,
  };

  setWebProviderState(next);
  return next;
}

export function getRehabPenalty(provider: WebProvider): number {
  const state = getWebProviderState(provider);
  if (state.rehabStage === 'probation') return 30;
  if (state.rehabStage === 'recovery') return 10;
  return 0;
}

export function getRehabStage(provider: WebProvider): RehabStage | undefined {
  return getWebProviderState(provider).rehabStage;
}

export function enterRehab(provider: WebProvider): void {
  const prev = getWebProviderState(provider);
  setWebProviderState({
    ...prev,
    rehabStage: 'probation',
    rehabSince: Date.now(),
  });
}

export function advanceRehab(provider: WebProvider): void {
  const prev = getWebProviderState(provider);
  const nextStage: RehabStage = prev.rehabStage === 'probation' ? 'recovery' : 'restored';
  setWebProviderState({
    ...prev,
    rehabStage: nextStage,
    rehabSince: prev.rehabSince ?? Date.now(),
  });
}
