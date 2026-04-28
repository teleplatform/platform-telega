import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { WebProviderRuntimeState } from './web-provider.state';
import type { WebProvider } from './web-provider.types';

const STATE_DIR = path.join(os.homedir(), '.telegpt', 'state');
const STATE_FILE = path.join(STATE_DIR, 'web-provider-runtime-state.json');

export interface PersistedWebProviderState {
  version: 1;
  providers: Record<WebProvider, WebProviderRuntimeState>;
  updatedAt: number;
}

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

export function loadPersistedWebProviderState(): PersistedWebProviderState | null {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw) as PersistedWebProviderState;
  } catch {
    return null;
  }
}

export function savePersistedWebProviderState(
  providers: Record<WebProvider, WebProviderRuntimeState>
): void {
  ensureStateDir();

  const payload: PersistedWebProviderState = {
    version: 1,
    providers,
    updatedAt: Date.now(),
  };

  fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), 'utf8');
}

export function clearPersistedWebProviderState(): void {
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }
  } catch {
    // ignore
  }
}