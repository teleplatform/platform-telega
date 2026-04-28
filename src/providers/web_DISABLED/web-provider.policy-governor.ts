import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { WebRuntimePolicyName } from './web-provider.policy';
import { recordPolicyChange, revertToPreviousPolicy, getPolicyHistory, getPreviousPolicy } from './web-provider.policy-history';
import { setActivePolicyName } from './web-provider.policy-state';

const STATE_DIR = path.join(os.homedir(), '.telegpt', 'state');
const POLICY_GOVERNOR_FILE = path.join(STATE_DIR, 'web-policy-governor.json');

const SWITCH_COOLDOWN_MS = 15 * 60 * 1000;
const Hysteresis_MIN_HINTS = 2;

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

export interface PolicyGovernorState {
  lastPolicyChangeAt: number;
  lastPolicyChangeReason: string;
  lastRecommendedPolicy?: WebRuntimePolicyName;
  lastRecommendedAt?: number;
  consecutiveSameRecommendations: number;
  policySwitchCooldownUntil?: number;
  isOverrideMode: boolean;
}

function loadGovernorState(): PolicyGovernorState {
  try {
    ensureStateDir();
    if (!fs.existsSync(POLICY_GOVERNOR_FILE)) {
      return {
        lastPolicyChangeAt: 0,
        lastPolicyChangeReason: 'initial',
        consecutiveSameRecommendations: 0,
        isOverrideMode: false,
      };
    }
    const content = fs.readFileSync(POLICY_GOVERNOR_FILE, 'utf8');
    return JSON.parse(content) as PolicyGovernorState;
  } catch {
    return {
      lastPolicyChangeAt: 0,
      lastPolicyChangeReason: 'initial',
      consecutiveSameRecommendations: 0,
      isOverrideMode: false,
    };
  }
}

function saveGovernorState(state: PolicyGovernorState): void {
  ensureStateDir();
  fs.writeFileSync(POLICY_GOVERNOR_FILE, JSON.stringify(state, null, 2), 'utf8');
}

export interface PolicyGovernorStatus {
  switchAllowed: boolean;
  cooldownRemainingMs: number;
  lastPolicyChangeAt: number;
  lastPolicyChangeReason: string;
  consecutiveSameRecommendations: number;
  isOverrideMode: boolean;
}

export function getPolicyGovernorStatus(): PolicyGovernorStatus {
  const state = loadGovernorState();
  const now = Date.now();
  const cooldownRemaining = state.policySwitchCooldownUntil
    ? Math.max(0, state.policySwitchCooldownUntil - now)
    : 0;
  
  return {
    switchAllowed: cooldownRemaining === 0 || state.isOverrideMode,
    cooldownRemainingMs: cooldownRemaining,
    lastPolicyChangeAt: state.lastPolicyChangeAt,
    lastPolicyChangeReason: state.lastPolicyChangeReason,
    consecutiveSameRecommendations: state.consecutiveSameRecommendations,
    isOverrideMode: state.isOverrideMode,
  };
}

export function canApplyPolicyHint(
  recommendedPolicy: WebRuntimePolicyName,
  confidence: 'low' | 'medium' | 'high'
): { allowed: boolean; reason?: string } {
  const state = loadGovernorState();
  const now = Date.now();
  
  if (state.isOverrideMode) {
    return { allowed: true };
  }
  
  if (state.policySwitchCooldownUntil && now < state.policySwitchCooldownUntil) {
    return {
      allowed: false,
      reason: 'switch_cooldown_active',
    };
  }
  
  if (confidence === 'low') {
    return {
      allowed: false,
      reason: 'low_confidence',
    };
  }
  
  if (recommendedPolicy !== state.lastRecommendedPolicy) {
    return {
      allowed: false,
      reason: 'recommendation_not_stable',
    };
  }
  
  if (state.consecutiveSameRecommendations < Hysteresis_MIN_HINTS) {
    return {
      allowed: false,
      reason: 'not_enough_consecutive_hints',
    };
  }
  
  return { allowed: true };
}

export function applyPolicyHint(
  recommendedPolicy: WebRuntimePolicyName,
  confidence: 'low' | 'medium' | 'high'
): { ok: boolean; error?: string } {
  const canApply = canApplyPolicyHint(recommendedPolicy, confidence);
  
  if (!canApply.allowed) {
    return { ok: false, error: canApply.reason };
  }
  
  setActivePolicyName(recommendedPolicy);
  recordPolicyChange(recommendedPolicy, 'policy_hint_applied', false);
  
  const state = loadGovernorState();
  state.lastPolicyChangeAt = Date.now();
  state.lastPolicyChangeReason = 'policy_hint_applied';
  state.policySwitchCooldownUntil = Date.now() + SWITCH_COOLDOWN_MS;
  state.consecutiveSameRecommendations = 0;
  state.isOverrideMode = false;
  saveGovernorState(state);
  
  return { ok: true };
}

export function forcePolicy(
  newPolicy: WebRuntimePolicyName,
  reason: string
): void {
  const oldState = getPolicyHistory().current;
  
  setActivePolicyName(newPolicy);
  recordPolicyChange(newPolicy, `operator_override: ${reason}`, true);
  
  const state = loadGovernorState();
  state.lastPolicyChangeAt = Date.now();
  state.lastPolicyChangeReason = `operator_override: ${reason}`;
  state.policySwitchCooldownUntil = undefined;
  state.consecutiveSameRecommendations = 0;
  state.isOverrideMode = true;
  state.lastRecommendedPolicy = newPolicy;
  saveGovernorState(state);
}

export function revertPolicy(): { ok: boolean; error?: string; revertedTo?: WebRuntimePolicyName } {
  const previous = getPreviousPolicy();
  
  if (!previous) {
    return { ok: false, error: 'no_previous_policy' };
  }
  
  setActivePolicyName(previous);
  recordPolicyChange(previous, 'operator_revert', true);
  
  const state = loadGovernorState();
  state.lastPolicyChangeAt = Date.now();
  state.lastPolicyChangeReason = 'operator_revert';
  state.policySwitchCooldownUntil = Date.now() + SWITCH_COOLDOWN_MS;
  state.isOverrideMode = false;
  saveGovernorState(state);
  
  return { ok: true, revertedTo: previous };
}

export function recordPolicyRecommendation(
  recommendedPolicy: WebRuntimePolicyName
): void {
  const state = loadGovernorState();
  const now = Date.now();
  
  if (recommendedPolicy === state.lastRecommendedPolicy) {
    state.consecutiveSameRecommendations++;
  } else {
    state.consecutiveSameRecommendations = 1;
    state.lastRecommendedPolicy = recommendedPolicy;
    state.lastRecommendedAt = now;
  }
  
  saveGovernorState(state);
}