import type { WebProviderId, SessionHealth } from "./cdp.types.js";
import { getCDPBrowser, createCDPConnection } from "./cdp.browser.js";
import { getCDPSessionManager } from "./cdp.session.js";
import { CDP_ENDPOINTS, PROVIDER_CONFIGS } from "./cdp.types.js";

export interface HealthCheckResult {
  provider: WebProviderId;
  state: SessionHealth;
  healthScore: number;
  url?: string;
  error?: string;
  lastCheck: number;
}

export class CDPHealthMonitor {
  private sessionManager = getCDPSessionManager();
  private checkIntervalMs = 30000;
  private lastChecks: Map<WebProviderId, HealthCheckResult> = new Map();

  async check(provider: WebProviderId): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const browser = getCDPBrowser({ debugPort: 9222 });
      
      try {
        await browser.connect();
      } catch (connError: any) {
        const result: HealthCheckResult = {
          provider,
          state: "browser_unreachable",
          healthScore: 0,
          error: connError.message,
          lastCheck: Date.now(),
        };
        this.lastChecks.set(provider, result);
        this.sessionManager.markUnhealthy(provider, "browser_unreachable", connError.message);
        return result;
      }

      const page = await browser.getOrCreatePage(provider);
      const state = await browser.checkSessionState(page);
      
      let healthScore = 0;
      if (state === "alive") {
        healthScore = 100;
        this.sessionManager.markHealthy(provider);
      } else if (state === "login_required") {
        healthScore = 20;
        this.sessionManager.markUnhealthy(provider, state, "Login required - manual authentication needed");
      } else {
        healthScore = 0;
        this.sessionManager.markUnhealthy(provider, state);
      }

      const result: HealthCheckResult = {
        provider,
        state,
        healthScore,
        url: page.url(),
        lastCheck: Date.now(),
      };
      
      this.lastChecks.set(provider, result);
      return result;
    } catch (error: any) {
      const result: HealthCheckResult = {
        provider,
        state: "browser_unreachable",
        healthScore: 0,
        error: error.message,
        lastCheck: Date.now(),
      };
      
      this.lastChecks.set(provider, result);
      this.sessionManager.markUnhealthy(provider, "browser_unreachable", error.message);
      return result;
    }
  }

  async checkAll(): Promise<HealthCheckResult[]> {
    const providers: WebProviderId[] = ["chatgpt_web", "qwen_web", "deepseek_web"];
    const results: HealthCheckResult[] = [];
    
    for (const provider of providers) {
      const result = await this.check(provider);
      results.push(result);
    }
    
    return results;
  }

  getLastCheck(provider: WebProviderId): HealthCheckResult | undefined {
    return this.lastChecks.get(provider);
  }

  getAllLastChecks(): HealthCheckResult[] {
    return Array.from(this.lastChecks.values());
  }
}

let healthMonitorInstance: CDPHealthMonitor | null = null;

export function getCDPHealthMonitor(): CDPHealthMonitor {
  if (!healthMonitorInstance) {
    healthMonitorInstance = new CDPHealthMonitor();
  }
  return healthMonitorInstance;
}

export function createCDPHealthMonitor(): CDPHealthMonitor {
  return new CDPHealthMonitor();
}

export async function quickHealthCheck(provider: WebProviderId): Promise<HealthCheckResult> {
  const monitor = getCDPHealthMonitor();
  return await monitor.check(provider);
}

export async function fullHealthCheck(): Promise<HealthCheckResult[]> {
  const monitor = getCDPHealthMonitor();
  return await monitor.checkAll();
}