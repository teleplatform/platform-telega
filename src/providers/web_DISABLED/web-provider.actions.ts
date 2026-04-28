import type { WebProvider } from './web-provider.types';
import type { RehabStage } from './web-provider.state';
import { getWebProviderState, setWebProviderState } from './web-provider.state';
import { recordAuditEvent } from './web-provider.audit';
import { getMissionControlView, type WebMissionControlView } from './web-provider.mission-control';
import { validateActionGuard, isValidAction } from './web-provider.guard';

export interface WebOperatorActionInput {
  action: 'reset' | 'disable' | 'enable' | 'rehab_set' | 'clear_cooldown' | 'bootstrap';
  provider: WebProvider;
  reason?: string;
  rehabStage?: RehabStage;
}

export interface WebOperatorActionResult {
  ok: boolean;
  action: string;
  provider: WebProvider;
  reason?: string;
  before?: ReturnType<typeof getWebProviderState>;
  after?: ReturnType<typeof getWebProviderState>;
  error?: string;
  missionControlSnapshot?: WebMissionControlView;
}

async function executeInternal(input: WebOperatorActionInput): Promise<WebOperatorActionResult> {
  const { action, provider, reason, rehabStage } = input;

  const guardError = validateActionGuard(action, provider, {
    reason,
    stage: rehabStage,
    requireReason: false,
  });

  if (guardError) {
    return {
      ok: false,
      action,
      provider,
      error: guardError.message,
    };
  }

  const before = getWebProviderState(provider);
  let after: ReturnType<typeof getWebProviderState>;
  let auditAction: 'reset' | 'disable' | 'enable' | 'rehab_set' | 'cooldown_cleared' | 'bootstrap' = 'bootstrap';

  switch (action) {
    case 'reset':
      after = { provider, consecutiveFailures: 0, consecutiveSuccesses: 0, rehabStage: 'restored' };
      auditAction = 'reset';
      break;

    case 'disable':
      after = { ...before, consecutiveFailures: 100, cooldownUntil: Date.now() + 86400000 };
      auditAction = 'disable';
      break;

    case 'enable':
      after = { provider, consecutiveFailures: 0, consecutiveSuccesses: 0, rehabStage: 'restored' };
      auditAction = 'enable';
      break;

    case 'rehab_set':
      if (!rehabStage) {
        return { ok: false, action, provider, error: 'rehab_stage_required' };
      }
      const now = Date.now();
      if (rehabStage === 'probation') {
        after = { ...before, rehabStage: 'probation', rehabSince: now };
      } else if (rehabStage === 'recovery') {
        after = { ...before, rehabStage: 'recovery', rehabSince: before.rehabSince ?? now };
      } else {
        after = { ...before, rehabStage: 'restored', rehabSince: undefined };
      }
      auditAction = 'rehab_set';
      break;

    case 'clear_cooldown':
      after = { ...before, cooldownUntil: undefined };
      auditAction = 'cooldown_cleared';
      break;

    case 'bootstrap':
      after = before;
      auditAction = 'bootstrap';
      break;

    default:
      return { ok: false, action, provider, error: 'unknown_action' };
  }

  setWebProviderState(after);

  (recordAuditEvent as (e: any) => void)({
    action: auditAction,
    provider,
    source: 'cli',
    operator: 'creator',
    reason: reason || `action=${action}`,
    before: before as unknown,
    after: after as unknown,
  });

  const snapshot = await getMissionControlView();

  return {
    ok: true,
    action,
    provider,
    reason,
    before,
    after,
    missionControlSnapshot: snapshot,
  };
}

export async function executeWebOperatorAction(input: WebOperatorActionInput): Promise<WebOperatorActionResult> {
  if (!isValidAction(input.action)) {
    return {
      ok: false,
      action: input.action,
      provider: input.provider,
      error: `Invalid action: ${input.action}`,
    };
  }

  return executeInternal(input);
}

export async function resetWebProviderAction(
  provider: WebProvider,
  reason?: string
): Promise<WebOperatorActionResult> {
  return executeWebOperatorAction({ action: 'reset', provider, reason: reason || 'manual_reset' });
}

export async function disableWebProviderAction(
  provider: WebProvider,
  reason?: string
): Promise<WebOperatorActionResult> {
  return executeWebOperatorAction({ action: 'disable', provider, reason: reason || 'manual_disable' });
}

export async function enableWebProviderAction(
  provider: WebProvider,
  reason?: string
): Promise<WebOperatorActionResult> {
  return executeWebOperatorAction({ action: 'enable', provider, reason: reason || 'manual_enable' });
}

export async function setWebProviderRehabAction(
  provider: WebProvider,
  stage: RehabStage,
  reason?: string
): Promise<WebOperatorActionResult> {
  return executeWebOperatorAction({
    action: 'rehab_set',
    provider,
    reason: reason || `set_to_${stage}`,
    rehabStage: stage,
  });
}

export async function clearWebProviderCooldownAction(
  provider: WebProvider,
  reason?: string
): Promise<WebOperatorActionResult> {
  return executeWebOperatorAction({ action: 'clear_cooldown', provider, reason: reason || 'manual_clear' });
}