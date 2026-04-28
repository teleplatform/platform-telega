import type { WebProvider } from './web-provider.types';
import type { RehabStage } from './web-provider.state';
import {
  getWebProviderState,
  setWebProviderState,
  clearRehab,
  enterRehab,
  advanceRehab,
  getRehabStage,
  persistWebProviderState,
} from './web-provider.state';

export interface WebProviderControlResult {
  ok: boolean;
  action: string;
  provider: WebProvider;
  state?: ReturnType<typeof getWebProviderState>;
  error?: string;
}

const ALL_PROVIDERS: WebProvider[] = ['chatgpt_web', 'qwen_web', 'deepseek_web'];

export function resetWebProviderCooldown(provider: WebProvider): WebProviderControlResult {
  const prev = getWebProviderState(provider);
  const next = { ...prev, cooldownUntil: undefined };
  setWebProviderState(next);

  return {
    ok: true,
    action: 'reset_cooldown',
    provider,
    state: next,
  };
}

export function setWebProviderRehabStage(
  provider: WebProvider,
  stage: RehabStage
): WebProviderControlResult {
  const prev = getWebProviderState(provider);
  const now = Date.now();

  let next: ReturnType<typeof getWebProviderState>;

  if (stage === 'probation') {
    next = { ...prev, rehabStage: 'probation' as const, rehabSince: now };
  } else if (stage === 'recovery') {
    next = { ...prev, rehabStage: 'recovery' as const, rehabSince: prev.rehabSince ?? now };
  } else {
    next = { ...prev, rehabStage: 'restored' as const, rehabSince: undefined };
  }

  setWebProviderState(next);

  return {
    ok: true,
    action: 'set_rehab_stage',
    provider,
    state: next,
  };
}

export function disableWebProvider(provider: WebProvider): WebProviderControlResult {
  const prev = getWebProviderState(provider);
  const next = { ...prev, consecutiveFailures: 100, cooldownUntil: Date.now() + 86400000 };
  setWebProviderState(next);

  return {
    ok: true,
    action: 'disable',
    provider,
    state: next,
  };
}

export function enableWebProvider(provider: WebProvider): WebProviderControlResult {
  const prev = getWebProviderState(provider);
  const next: ReturnType<typeof getWebProviderState> = {
    ...prev,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    cooldownUntil: undefined,
    rehabStage: 'restored',
    rehabSince: undefined,
    lastFailureReason: undefined,
  };
  setWebProviderState(next);

  return {
    ok: true,
    action: 'enable',
    provider,
    state: next,
  };
}

export function clearWebProviderState(provider: WebProvider): WebProviderControlResult {
  const defaultState: ReturnType<typeof getWebProviderState> = {
    provider,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    rehabStage: 'restored',
  };
  setWebProviderState(defaultState);

  return {
    ok: true,
    action: 'clear_state',
    provider,
    state: defaultState,
  };
}

export function advanceWebProviderRehab(provider: WebProvider): WebProviderControlResult {
  const currentStage = getRehabStage(provider);
  
  if (currentStage === 'probation') {
    advanceRehab(provider);
  } else if (currentStage === 'recovery') {
    advanceRehab(provider);
  }

  const next = getWebProviderState(provider);

  return {
    ok: true,
    action: 'advance_rehab',
    provider,
    state: next,
  };
}