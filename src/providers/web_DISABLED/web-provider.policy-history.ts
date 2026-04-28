import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { WebRuntimePolicyName } from './web-provider.policy';

const STATE_DIR = path.join(os.homedir(), '.telegpt', 'state');
const POLICY_HISTORY_FILE = path.join(STATE_DIR, 'web-policy-history.json');

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

export interface PolicyHistoryEntry {
  policy: WebRuntimePolicyName;
  changedAt: number;
  reason: string;
  wasOverride: boolean;
}

export interface PolicyHistoryState {
  current: WebRuntimePolicyName;
  previous?: WebRuntimePolicyName;
  history: PolicyHistoryEntry[];
}

function loadHistoryState(): PolicyHistoryState {
  try {
    ensureStateDir();
    if (!fs.existsSync(POLICY_HISTORY_FILE)) {
      return { current: 'balanced', history: [] };
    }
    const content = fs.readFileSync(POLICY_HISTORY_FILE, 'utf8');
    return JSON.parse(content) as PolicyHistoryState;
  } catch {
    return { current: 'balanced', history: [] };
  }
}

function saveHistoryState(state: PolicyHistoryState): void {
  ensureStateDir();
  fs.writeFileSync(POLICY_HISTORY_FILE, JSON.stringify(state, null, 2), 'utf8');
}

export function recordPolicyChange(
  newPolicy: WebRuntimePolicyName,
  reason: string,
  isOverride: boolean = false,
  preservePrevious: boolean = false
): void {
  const state = loadHistoryState();
  
  if (!preservePrevious && state.current !== newPolicy) {
    state.previous = state.current;
  }
  
  state.current = newPolicy;
  
  state.history.unshift({
    policy: newPolicy,
    changedAt: Date.now(),
    reason,
    wasOverride: isOverride,
  });
  
  state.history = state.history.slice(0, 20);
  
  saveHistoryState(state);
}

export function getPolicyHistory(): PolicyHistoryState {
  return loadHistoryState();
}

export function getPreviousPolicy(): WebRuntimePolicyName | undefined {
  const state = loadHistoryState();
  return state.previous;
}

export function revertToPreviousPolicy(reason: string): boolean {
  const state = loadHistoryState();
  
  if (!state.previous) {
    return false;
  }
  
  recordPolicyChange(state.previous, reason, true);
  return true;
}

export function getPolicyHistoryEntries(count: number = 10): PolicyHistoryEntry[] {
  const state = loadHistoryState();
  return state.history.slice(0, count);
}