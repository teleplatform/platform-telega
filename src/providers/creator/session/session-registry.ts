export type BridgeProviderId = "chatgpt_web" | "qwen_web" | "deepseek_web" | "grok_web" | "kimi_web" | "perplexity_web" | "claude_web";

export type SessionProviderId = BridgeProviderId;

export type SessionState = 
  | "ok" 
  | "expired" 
  | "not_authenticated"
  | "blocked" 
  | "captcha" 
  | "rate_limited" 
  | "not_configured"
  | "disabled"
  | "unknown"
  | "pending";

export interface CreatorSessionEntry {
  id: SessionProviderId;
  enabled: boolean;
  state: SessionState;
  lastOk: number | null;
  lastChecked: number | null;
  cooldownUntil: number | null;
  profilePath?: string;
  authCookiePath?: string;
  healthScore: number;
}

export interface SessionRegistry {
  get(id: SessionProviderId): CreatorSessionEntry | undefined;
  set(id: SessionProviderId, entry: CreatorSessionEntry): void;
  list(): CreatorSessionEntry[];
  getAvailable(): SessionProviderId[];
  markOk(id: SessionProviderId): void;
  markError(id: SessionProviderId, state: SessionState, cooldownMs?: number): void;
  isAvailable(id: SessionProviderId): boolean;
  disable(id: SessionProviderId): void;
  enable(id: SessionProviderId): void;
}

const DEFAULT_COOLDOWN_MS = 60000;
const MAX_HEALTH_SCORE = 100;

function createEntry(id: SessionProviderId): CreatorSessionEntry {
  return {
    id,
    enabled: true,
    state: "pending",
    lastOk: null,
    lastChecked: null,
    cooldownUntil: null,
    healthScore: 50,
  };
}

class InMemorySessionRegistry implements SessionRegistry {
  private sessions = new Map<SessionProviderId, CreatorSessionEntry>();

  constructor() {
    const providers: SessionProviderId[] = ["chatgpt_web", "qwen_web", "deepseek_web", "grok_web", "kimi_web", "perplexity_web", "claude_web"];
    for (const id of providers) {
      this.sessions.set(id, createEntry(id));
    }
  }

  get(id: SessionProviderId): CreatorSessionEntry | undefined {
    return this.sessions.get(id);
  }

  set(id: SessionProviderId, entry: CreatorSessionEntry): void {
    this.sessions.set(id, entry);
  }

  list(): CreatorSessionEntry[] {
    return Array.from(this.sessions.values());
  }

  getAvailable(): SessionProviderId[] {
    const now = Date.now();
    const available: SessionProviderId[] = [];
    
    for (const entry of this.sessions.values()) {
      const inCooldown = entry.cooldownUntil && entry.cooldownUntil > now;
      if (entry.enabled && !inCooldown) {
        if (entry.state === "ok" || entry.state === "pending" || entry.state === "unknown") {
          available.push(entry.id);
        }
      }
    }
    
    return available;
  }

  markOk(id: SessionProviderId): void {
    const entry = this.sessions.get(id);
    if (!entry) return;
    
    entry.state = "ok";
    entry.lastOk = Date.now();
    entry.lastChecked = Date.now();
    entry.cooldownUntil = null;
    entry.healthScore = Math.min(entry.healthScore + 10, MAX_HEALTH_SCORE);
    
    this.sessions.set(id, entry);
  }

  markError(id: SessionProviderId, state: SessionState, cooldownMs = DEFAULT_COOLDOWN_MS): void {
    const entry = this.sessions.get(id);
    if (!entry) return;
    
    entry.state = state;
    entry.lastChecked = Date.now();
    entry.cooldownUntil = Date.now() + cooldownMs;
    entry.healthScore = Math.max(entry.healthScore - 20, 0);
    
    this.sessions.set(id, entry);
  }

  isAvailable(id: SessionProviderId): boolean {
    const entry = this.sessions.get(id);
    if (!entry || !entry.enabled || entry.state !== "ok") {
      return false;
    }
    
    const now = Date.now();
    if (entry.cooldownUntil && entry.cooldownUntil > now) {
      return false;
    }
    
    return true;
  }

  disable(id: SessionProviderId): void {
    const entry = this.sessions.get(id);
    if (!entry) return;
    
    entry.enabled = false;
    entry.state = "disabled";
    this.sessions.set(id, entry);
  }

  enable(id: SessionProviderId): void {
    const entry = this.sessions.get(id);
    if (!entry) return;
    
    entry.enabled = true;
    if (entry.state === "disabled") {
      entry.state = "ok";
    }
    this.sessions.set(id, entry);
  }
}

let registryInstance: SessionRegistry | null = null;

export function getSessionRegistry(): SessionRegistry {
  if (!registryInstance) {
    registryInstance = new InMemorySessionRegistry();
  }
  return registryInstance;
}

export function createSessionRegistry(): SessionRegistry {
  return new InMemorySessionRegistry();
}