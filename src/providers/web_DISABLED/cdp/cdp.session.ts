import type { CDPSession, WebProviderId, SessionHealth, CDPExecutionResult } from "./cdp.types.js";

export class CDPSessionManager {
  private sessions: Map<WebProviderId, CDPSession> = new Map();
  private defaultCooldownMs = 60000;

  constructor() {
    this.initializeSessions();
  }

  private initializeSessions(): void {
    const providers: WebProviderId[] = ["chatgpt_web", "qwen_web", "deepseek_web"];
    
    for (const provider of providers) {
      this.sessions.set(provider, {
        id: provider,
        provider,
        state: "browser_unreachable",
        healthScore: 0,
        enabled: true,
        lastCheck: 0,
      });
    }
  }

  get(provider: WebProviderId): CDPSession | undefined {
    return this.sessions.get(provider);
  }

  list(): CDPSession[] {
    return Array.from(this.sessions.values());
  }

  update(provider: WebProviderId, updates: Partial<CDPSession>): void {
    const session = this.sessions.get(provider);
    if (session) {
      this.sessions.set(provider, { ...session, ...updates });
    }
  }

  markHealthy(provider: WebProviderId): void {
    this.sessions.set(provider, {
      id: provider,
      provider,
      state: "alive",
      healthScore: 100,
      enabled: true,
      lastCheck: Date.now(),
      cooldownUntil: undefined,
    });
  }

  markUnhealthy(provider: WebProviderId, state: SessionHealth, error?: string): void {
    const cooldownMs = state === "challenge_detected" ? 300000 : 
                      state === "login_required" ? 300000 : 
                      60000;

    this.sessions.set(provider, {
      id: provider,
      provider,
      state,
      healthScore: state === "login_required" ? 20 : 0,
      enabled: state !== "browser_unreachable",
      lastCheck: Date.now(),
      lastError: error,
      cooldownUntil: Date.now() + cooldownMs,
    });
  }

  isEnabled(provider: WebProviderId): boolean {
    const session = this.sessions.get(provider);
    return session?.enabled || false;
  }

  isHealthy(provider: WebProviderId): boolean {
    const session = this.sessions.get(provider);
    if (!session || !session.enabled) return false;
    
    if (session.cooldownUntil && session.cooldownUntil > Date.now()) {
      return false;
    }
    
    return session.state === "alive";
  }

  getHealthy(): WebProviderId | null {
    for (const [provider, session] of this.sessions) {
      if (this.isHealthy(provider)) {
        return provider;
      }
    }
    return null;
  }

  getAllHealthy(): WebProviderId[] {
    const healthy: WebProviderId[] = [];
    for (const provider of this.sessions.keys()) {
      if (this.isHealthy(provider)) {
        healthy.push(provider);
      }
    }
    return healthy;
  }

  enable(provider: WebProviderId): void {
    const session = this.sessions.get(provider);
    if (session) {
      this.sessions.set(provider, { ...session, enabled: true });
    }
  }

  disable(provider: WebProviderId): void {
    const session = this.sessions.get(provider);
    if (session) {
      this.sessions.set(provider, { ...session, enabled: false });
    }
  }

  setCooldown(provider: WebProviderId, cooldownMs?: number): void {
    const session = this.sessions.get(provider);
    if (session) {
      this.sessions.set(provider, {
        ...session,
        cooldownUntil: Date.now() + (cooldownMs || this.defaultCooldownMs),
      });
    }
  }

  clearCooldown(provider: WebProviderId): void {
    const session = this.sessions.get(provider);
    if (session) {
      this.sessions.set(provider, { ...session, cooldownUntil: undefined });
    }
  }
}

let sessionManagerInstance: CDPSessionManager | null = null;

export function getCDPSessionManager(): CDPSessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new CDPSessionManager();
  }
  return sessionManagerInstance;
}

export function createCDPSessionManager(): CDPSessionManager {
  return new CDPSessionManager();
}