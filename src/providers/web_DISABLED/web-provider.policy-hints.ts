import type { WebProvider } from './web-provider.types';
import { getWebProviderState } from './web-provider.state';
import { getAuditLog } from './web-provider.audit';
import { getActiveWebRuntimePolicy } from './web-provider.policy-apply';
import { recordPolicyRecommendation } from './web-provider.policy-governor';
import type { WebRuntimePolicyName } from './web-provider.policy';

export type WebPolicyConfidence = 'low' | 'medium' | 'high';

export interface WebPolicyHint {
  recommended: WebRuntimePolicyName;
  confidence: WebPolicyConfidence;
  reasons: string[];
}

function analyzeRecentProviderBehavior(): {
  cloudflareCount: number;
  timeoutCount: number;
  successCount: number;
  failureCount: number;
  openaiSkippedCount: number;
  qwenSuccessCount: number;
  deepseekSuccessCount: number;
  openaiConsecutiveFailures: number;
  qwenConsecutiveSuccesses: number;
  avgCooldownMs: number;
} {
  const events = getAuditLog(100);
  
  let cloudflareCount = 0;
  let timeoutCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let openaiSkippedCount = 0;
  let qwenSuccessCount = 0;
  let deepseekSuccessCount = 0;

  for (const event of events) {
    const reason = (event.reason || '').toLowerCase();
    if (reason.includes('cloudflare') || reason.includes('challenge') || reason.includes('login')) {
      cloudflareCount++;
    }
    if (reason.includes('timeout')) {
      timeoutCount++;
    }
    if (event.action === 'success' || event.action === 'provider_success') {
      successCount++;
      if (event.provider === 'qwen_web') {
        qwenSuccessCount++;
      }
      if (event.provider === 'deepseek_web') {
        deepseekSuccessCount++;
      }
    }
    if (event.action === 'failure' || event.action === 'provider_failure') {
      failureCount++;
    }
    if (event.action === 'skipped' && event.provider === 'openai_web') {
      openaiSkippedCount++;
    }
  }

  const openaiState = getWebProviderState('openai_web');
  const qwenState = getWebProviderState('qwen_web');

  const cooldownTimes: number[] = [];
  for (const event of events) {
    if (event.reason && event.action === 'cooldown_set') {
      const match = event.reason.match(/(\d+)/);
      if (match) {
        cooldownTimes.push(parseInt(match[1], 10));
      }
    }
  }
  const avgCooldownMs = cooldownTimes.length > 0
    ? cooldownTimes.reduce((a, b) => a + b, 0) / cooldownTimes.length
    : 0;

  return {
    cloudflareCount,
    timeoutCount,
    successCount,
    failureCount,
    openaiSkippedCount,
    qwenSuccessCount,
    deepseekSuccessCount,
    openaiConsecutiveFailures: openaiState.consecutiveFailures,
    qwenConsecutiveSuccesses: qwenState.consecutiveSuccesses,
    avgCooldownMs,
  };
}

export function getRecommendedWebRuntimePolicy(): WebPolicyHint {
  const behavior = analyzeRecentProviderBehavior();
  const activePolicy = getActiveWebRuntimePolicy();
  
  const reasons: string[] = [];
  
  let recommendSafe = false;
  let recommendAggressive = false;

  if (behavior.cloudflareCount >= 4) {
    reasons.push(`openai_web blocked by cloudflare/challenge ${behavior.cloudflareCount} times recently`);
    recommendSafe = true;
  }

  if (behavior.openaiSkippedCount >= 3) {
    reasons.push(`openai_web skipped ${behavior.openaiSkippedCount} times in recent executions`);
    recommendSafe = true;
  }

  if (behavior.openaiConsecutiveFailures >= 5) {
    reasons.push(`openai_web has ${behavior.openaiConsecutiveFailures} consecutive failures`);
    recommendSafe = true;
  }

  if (behavior.timeoutCount >= 4) {
    reasons.push(`timeout errors detected ${behavior.timeoutCount} times recently`);
    recommendSafe = true;
  }

  if (behavior.qwenSuccessCount >= 4 && behavior.deepseekSuccessCount >= 2) {
    reasons.push(`fallback providers stable: qwen_web=${behavior.qwenSuccessCount}, deepseek_web=${behavior.deepseekSuccessCount} successes`);
  }

  if (!recommendSafe && behavior.qwenConsecutiveSuccesses >= 3) {
    reasons.push(`qwen_web showing recovery with ${behavior.qwenConsecutiveSuccesses} consecutive successes`);
    recommendAggressive = true;
  }

  if (!recommendSafe && behavior.openaiConsecutiveFailures === 0 && behavior.openaiSkippedCount === 0) {
    reasons.push(`openai_web currently not blocked`);
  }

  if (behavior.avgCooldownMs > 0 && behavior.avgCooldownMs < 60000 && !recommendSafe) {
    reasons.push(`cooldowns are short (avg ${Math.round(behavior.avgCooldownMs / 1000)}s), providers recovering quickly`);
    recommendAggressive = true;
  }

  const totalEvents = behavior.successCount + behavior.failureCount;
  const failureRatio = totalEvents > 0 ? behavior.failureCount / totalEvents : 0;
  
  if (failureRatio > 0.7) {
    if (!recommendSafe) {
      reasons.push(`high failure rate (${Math.round(failureRatio * 100)}%)`);
      recommendSafe = true;
    }
  } else if (failureRatio < 0.3) {
    if (!recommendSafe) {
      reasons.push(`low failure rate (${Math.round(failureRatio * 100)}%) suggests stability`);
    }
  }

  let recommended: WebRuntimePolicyName;
  let confidence: WebPolicyConfidence;

  if (recommendSafe && !recommendAggressive) {
    recommended = 'safe';
    confidence = reasons.length >= 2 ? 'high' : 'medium';
  } else if (recommendAggressive && !recommendSafe) {
    recommended = 'aggressive_recovery';
    confidence = reasons.length >= 2 ? 'high' : 'medium';
  } else {
    recommended = 'balanced';
    confidence = 'low';
    reasons.push('No strong signals detected, defaulting to balanced');
  }

  if (reasons.length === 0) {
    reasons.push('System behavior is stable, no specific policy recommendation');
    recommended = 'balanced';
    confidence = 'low';
  }

  if (recommended === activePolicy.name) {
    reasons.push(`Already on recommended policy: ${recommended}`);
    confidence = confidence === 'low' ? 'low' : 'medium';
  }

  recordPolicyRecommendation(recommended);

  return {
    recommended,
    confidence,
    reasons,
  };
}