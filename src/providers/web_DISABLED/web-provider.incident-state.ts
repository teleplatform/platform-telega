import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const STATE_DIR = path.join(os.homedir(), '.telegpt', 'state');
const INCIDENT_STATE_FILE = path.join(STATE_DIR, 'web-incident-state.json');

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

export type RuntimeMode = 'normal' | 'degraded' | 'incident';
export type IncidentLevel = 'degraded' | 'incident';

export interface IncidentState {
  mode: RuntimeMode;
  level?: IncidentLevel;
  active: boolean;
  reasons: string[];
  enteredAt?: number;
  exitConditions: {
    consecutiveSuccessesRequired: number;
    currentConsecutiveSuccesses: number;
    minProvidersReadyRequired: number;
    currentProvidersReady: number;
  };
}

export function getDefaultState(): IncidentState {
  return {
    mode: 'normal',
    active: false,
    reasons: [],
    exitConditions: {
      consecutiveSuccessesRequired: 5,
      currentConsecutiveSuccesses: 0,
      minProvidersReadyRequired: 2,
      currentProvidersReady: 0,
    },
  };
}

export function loadIncidentState(): IncidentState {
  try {
    ensureStateDir();
    if (!fs.existsSync(INCIDENT_STATE_FILE)) {
      return getDefaultState();
    }
    const content = fs.readFileSync(INCIDENT_STATE_FILE, 'utf8');
    return JSON.parse(content) as IncidentState;
  } catch {
    return getDefaultState();
  }
}

export function saveIncidentState(state: IncidentState): void {
  ensureStateDir();
  fs.writeFileSync(INCIDENT_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

export function getCurrentRuntimeMode(): RuntimeMode {
  const state = loadIncidentState();
  return state.mode;
}

export function getIncidentActive(): boolean {
  const state = loadIncidentState();
  return state.active;
}

export function getIncidentDetails(): {
  active: boolean;
  mode: RuntimeMode;
  level?: IncidentLevel;
  reasons: string[];
  enteredAt?: number;
} | null {
  const state = loadIncidentState();
  if (!state.active) {
    return null;
  }
  return {
    active: state.active,
    mode: state.mode,
    level: state.level,
    reasons: state.reasons,
    enteredAt: state.enteredAt,
  };
}