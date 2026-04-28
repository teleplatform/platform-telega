import type { WebProvider } from './web-provider.types';
import type { RehabStage } from './web-provider.state';

const VALID_PROVIDERS: WebProvider[] = ['openai_web', 'qwen_web', 'deepseek_web'];
const VALID_REHAB_STAGES: RehabStage[] = ['probation', 'recovery', 'restored'];

export interface ActionValidationError {
  code: 'INVALID_PROVIDER' | 'INVALID_REHAB_STAGE' | 'MISSING_REASON' | 'PROVIDER_DISABLED';
  message: string;
}

export function validateProvider(provider: unknown): provider is WebProvider {
  return VALID_PROVIDERS.includes(provider as WebProvider);
}

export function validateRehabStage(stage: unknown): stage is RehabStage {
  return VALID_REHAB_STAGES.includes(stage as RehabStage);
}

export function validateActionGuard(
  action: string,
  provider: WebProvider,
  options?: { reason?: string; stage?: RehabStage; requireReason?: boolean }
): ActionValidationError | null {
  if (!validateProvider(provider)) {
    return {
      code: 'INVALID_PROVIDER',
      message: `Invalid provider: ${provider}`,
    };
  }

  if (options?.stage !== undefined && !validateRehabStage(options.stage)) {
    return {
      code: 'INVALID_REHAB_STAGE',
      message: `Invalid rehab stage: ${options.stage}`,
    };
  }

  if (options?.requireReason && !options.reason) {
    return {
      code: 'MISSING_REASON',
      message: 'Action requires a reason in operator mode',
    };
  }

  return null;
}

export function isValidAction(action: string): boolean {
  return ['reset', 'disable', 'enable', 'rehab_set', 'clear_cooldown', 'bootstrap'].includes(action);
}