import fs from "fs";
import path from "path";

const DATA_DIR = ".data";
const PREFERENCES_FILE = path.join(DATA_DIR, "user-preferences.json");
const TRACES_FILE = path.join(DATA_DIR, "traces.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export type StoredUserPreference = {
  userId: string;
  defaultIntent?: "fast" | "quality" | "cheap" | "local_only" | "no_fallback";
  explainMode?: "short" | "full";
  creatorEnabled?: boolean;
  lastUpdated: number;
};

export type StoredTrace = {
  traceId: string;
  userId?: string;
  decisions: Array<{
    step: string;
    provider: string | null;
    model: string | null;
    decision: string;
    reason: string;
    timestamp: number;
  }>;
  final: {
    provider: string;
    model: string;
    success: boolean;
    fallback_used: boolean;
    error_type?: string;
  } | null;
  createdAt: number;
};

export type StoredSettings = {
  budgetPolicy: {
    max_cost_per_request: number;
    max_cost_per_session: number;
    prefer_cheaper: boolean;
    tier_cap: string;
  };
  lastUpdated: number;
};

function loadJson<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data) as T;
    }
  } catch (e) {
    console.error(`[persistence] Failed to load ${filePath}:`, e);
  }
  return defaultValue;
}

function saveJson<T>(filePath: string, data: T): void {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error(`[persistence] Failed to save ${filePath}:`, e);
  }
}

const DEFAULT_SETTINGS: StoredSettings = {
  budgetPolicy: {
    max_cost_per_request: 0.5,
    max_cost_per_session: 10.0,
    prefer_cheaper: true,
    tier_cap: "premium",
  },
  lastUpdated: Date.now(),
};

export function loadUserPreferences(): StoredUserPreference[] {
  return loadJson<StoredUserPreference[]>(PREFERENCES_FILE, []);
}

export function saveUserPreferences(prefs: StoredUserPreference[]): void {
  saveJson(PREFERENCES_FILE, prefs);
}

export function loadTraces(): StoredTrace[] {
  return loadJson<StoredTrace[]>(TRACES_FILE, []);
}

export function saveTraces(traces: StoredTrace[]): void {
  saveJson(TRACES_FILE, traces);
}

export function loadSettings(): StoredSettings {
  return loadJson<StoredSettings>(SETTINGS_FILE, DEFAULT_SETTINGS);
}

export function saveSettings(settings: StoredSettings): void {
  saveJson(SETTINGS_FILE, settings);
}

export function clearOldTraces(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
  const traces = loadTraces();
  const cutoff = Date.now() - maxAgeMs;
  const filtered = traces.filter(t => t.createdAt > cutoff);
  const removed = traces.length - filtered.length;
  if (removed > 0) {
    saveTraces(filtered);
  }
  return removed;
}