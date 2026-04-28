import type { WebProvider } from './web-provider.types';
import {
  getWebProviderState,
  isProviderCoolingDown,
  getCooldownRemainingMs,
  getRehabStage,
} from './web-provider.state';
import { scoreWebProvider, sortWebProvidersByPriority } from './web-provider.priority';
import { getWebProviderHealth } from './web-provider.execute';
import { getAuditLog } from './web-provider.audit';
import { getActiveWebRuntimePolicy } from './web-provider.policy-apply';
import { getRecommendedWebRuntimePolicy, type WebPolicyHint } from './web-provider.policy-hints';
import { getPolicyGovernorStatus, type PolicyGovernorStatus } from './web-provider.policy-governor';
import { detectAndUpdateRuntimeMode } from './web-provider.incident';
import type { WebRuntimePolicyName } from './web-provider.policy';

export interface WebMissionControlProvider {
  provider: WebProvider;
  ready: boolean;
  enabled: boolean;
  score: number;
  cooldownRemainingMs: number | undefined;
  rehabStage: 'probation' | 'recovery' | 'restored' | undefined;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  lastFailureReason?: string;
  lastLatencyMs?: number;
}

export interface WebMissionControlView {
  generatedAt: number;
  activePolicy: WebRuntimePolicyName;
  runtimeMode: 'normal' | 'degraded' | 'incident';
  policyHint?: WebPolicyHint;
  policyGovernor?: PolicyGovernorStatus;
  providers: WebMissionControlProvider[];
  selectedOrder: WebProvider[];
  recentAuditEvents: Array<{
    ts: number;
    action: string;
    provider: string;
    reason?: string;
  }>;
}

const ALL_PROVIDERS: WebProvider[] = ['openai_web', 'qwen_web', 'deepseek_web'];

export async function getMissionControlView(): Promise<WebMissionControlView> {
  const now = Date.now();
  const activePolicy = getActiveWebRuntimePolicy();
  const policyHint = getRecommendedWebRuntimePolicy();
  const policyGovernor = getPolicyGovernorStatus();
  const runtimeMode = detectAndUpdateRuntimeMode();
  const providers: WebMissionControlProvider[] = [];

  for (const provider of ALL_PROVIDERS) {
    const state = getWebProviderState(provider);
    const health = await getWebProviderHealth(provider);
    const score = scoreWebProvider(provider);
    const coolingDown = isProviderCoolingDown(provider, now);
    const cooldownRemaining = coolingDown ? getCooldownRemainingMs(provider, now) : undefined;
    const rehabStage = getRehabStage(provider);

    const enabled = !coolingDown && state.consecutiveFailures < 50;

    providers.push({
      provider,
      ready: health.ready,
      enabled,
      score,
      cooldownRemainingMs: cooldownRemaining ?? undefined,
      rehabStage: rehabStage ?? 'restored',
      consecutiveSuccesses: state.consecutiveSuccesses,
      consecutiveFailures: state.consecutiveFailures,
      lastFailureReason: state.lastFailureReason,
      lastLatencyMs: state.lastLatencyMs,
    });
  }

  const selectedOrder = sortWebProvidersByPriority(ALL_PROVIDERS);
  const recentAudit = getAuditLog(20).map(e => ({
    ts: e.ts,
    action: e.action,
    provider: e.provider,
    reason: e.reason,
  }));

  return {
    generatedAt: now,
    activePolicy: activePolicy.name,
    runtimeMode,
    policyHint,
    policyGovernor,
    providers,
    selectedOrder,
    recentAuditEvents: recentAudit,
  };
}