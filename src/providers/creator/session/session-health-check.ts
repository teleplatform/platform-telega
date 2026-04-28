import { chromium, Browser, Page } from "playwright";
import path from "node:path";
import os from "node:os";
import type { SessionProviderId, SessionState, SessionRegistry } from "./session-registry.js";
import { getWebAdapter } from "./adapters.js";

export interface HealthCheckResult {
  provider: SessionProviderId;
  state: SessionState;
  isLoggedIn: boolean;
  healthScore: number;
  lastChecked: number;
  error?: string;
}

const getCreatorProfileDir = (providerId: SessionProviderId): string => {
  const HOME = os.homedir();
  const BASE_DIR = path.join(HOME, ".telegpt", "chrome-profiles");
  
  if (providerId === "chatgpt_web") {
    return path.join(BASE_DIR, "chatgpt-creator");
  } else if (providerId === "qwen_web") {
    return path.join(BASE_DIR, "qwen-creator");
  } else if (providerId === "deepseek_web") {
    return path.join(BASE_DIR, "deepseek-creator");
  } else if (providerId === "kimi_web") {
    return path.join(BASE_DIR, "kimi-creator");
  }
  return path.join(BASE_DIR, "chatgpt-creator");
};

const providerProfileDirs: Record<SessionProviderId, string> = {
  chatgpt_web: getCreatorProfileDir("chatgpt_web"),
  qwen_web: getCreatorProfileDir("qwen_web"),
  deepseek_web: getCreatorProfileDir("deepseek_web"),
  kimi_web: getCreatorProfileDir("kimi_web"),
};

const HEALTH_CHECK_TIMEOUT_MS = Number(
  process.env.CREATOR_BRIDGE_EXEC_TIMEOUT_MS || 
  process.env.TELEGPT_UPSTREAM_TIMEOUT_MS || 
  30000
);

function isChatGptUrl(url?: string): boolean {
  return typeof url === "string" && (
    url.startsWith("https://chatgpt.com") ||
    url.startsWith("https://chat.openai.com") ||
    url.includes("chatgpt.com")
  );
}

async function checkSingleSession(
  providerId: SessionProviderId,
  registry: SessionRegistry
): Promise<HealthCheckResult> {
  const adapter = getWebAdapter(providerId);
  const profileDir = providerProfileDirs[providerId];
  
  if (providerId === "chatgpt_web") {
    return await checkViaCDP(providerId, registry);
  }
  
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    const context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1440, height: 900 },
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--no-sandbox",
      ],
    });
    
    page = context.pages()[0] || (await context.newPage());
    await page.goto(adapter.loginUrl, { timeout: HEALTH_CHECK_TIMEOUT_MS });
    
    await page.waitForTimeout(8000);
    
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      const title = await page.title().catch(() => "");
      const url = page.url();
      
      console.log(`[health-check] Attempt ${attempts + 1}: URL=${url}, Title=${title}`);
      
      if (!title.includes("Один момент") && !title.includes("Just a moment") && !title.includes("Checking")) {
        break;
      }
      
      await page.waitForTimeout(3000);
      attempts++;
    }
    
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    
    const url = page.url();
    const title = await page.title().catch(() => "");
    const isLoggedIn = await adapter.isLoggedIn(page);
    
    console.log(`[health-check] URL: ${url}, Title: ${title}, isLoggedIn: ${isLoggedIn}`);
    
    let state: SessionState;
    
    if (isLoggedIn) {
      state = "ok";
    } else if (url.includes("/login") || url.includes("/signin") || url.includes("/auth")) {
      state = "not_authenticated";
    } else if (url.includes("blocked") || url.includes("access denied") || url.includes("forbidden")) {
      state = "blocked";
    } else {
      state = "not_authenticated";
    }
    
    const entry = registry.get(providerId);
    const healthScore = entry?.healthScore || 0;
    
    if (state === "ok") {
      registry.markOk(providerId);
    } else if (state === "not_authenticated") {
      registry.markError(providerId, "expired", 60000);
    } else {
      registry.markError(providerId, state, 300000);
    }
    
    await context.close();
    
    return {
      provider: providerId,
      state,
      isLoggedIn: state === "ok",
      healthScore,
      lastChecked: Date.now(),
    };
} catch (error: any) {
    let errorState: SessionState = "blocked";
    
    if (error.message?.includes("timeout")) {
      errorState = "rate_limited";
    }
    
    registry.markError(providerId, errorState, 60000);
    
    return {
      provider: providerId,
      state: errorState,
      isLoggedIn: false,
      healthScore: 0,
      lastChecked: Date.now(),
      error: error.message,
    };
  }
}

async function checkViaCDP(
  providerId: SessionProviderId,
  registry: SessionRegistry
): Promise<HealthCheckResult> {
  const CDP_URL = "http://127.0.0.1:9222";
  
  try {
    const browser = await chromium.connectOverCDP(CDP_URL);
    const contexts = browser.contexts();
    
    if (!contexts.length) {
      registry.markError(providerId, "not_authenticated", 60000);
      return {
        provider: providerId,
        state: "not_authenticated",
        isLoggedIn: false,
        healthScore: 0,
        lastChecked: Date.now(),
        error: "No CDP contexts",
      };
    }
    
    const context = contexts[0];
    const pages = context.pages();
    const page = pages.find(p => 
      p.url().includes("chatgpt.com") || p.url().includes("chat.openai.com")
    );
    
    if (!page) {
      registry.markError(providerId, "not_authenticated", 60000);
      await browser.close();
      return {
        provider: providerId,
        state: "not_authenticated",
        isLoggedIn: false,
        healthScore: 0,
        lastChecked: Date.now(),
        error: "No OpenAI page in Chrome",
      };
    }
    
    const html = await page.content().catch(() => "");
    const url = page.url();
    
    await browser.close();
    
    const hasCloudflare = html.includes("Just a moment") || html.includes("Cloudflare");
    const hasLogin = url.includes("/login") || url.includes("/signin") || html.includes('name="login"');
    
    if (hasCloudflare) {
      registry.markError(providerId, "blocked", 300000);
      return {
        provider: providerId,
        state: "blocked",
        isLoggedIn: false,
        healthScore: 0,
        lastChecked: Date.now(),
        error: "Cloudflare challenge",
      };
    }
    
    if (hasLogin) {
      registry.markError(providerId, "not_authenticated", 60000);
      return {
        provider: providerId,
        state: "not_authenticated",
        isLoggedIn: false,
        healthScore: 0,
        lastChecked: Date.now(),
        error: "Login required",
      };
    }
    
    registry.markOk(providerId);
    return {
      provider: providerId,
      state: "ok",
      isLoggedIn: true,
      healthScore: 100,
      lastChecked: Date.now(),
    };
  } catch (error: any) {
    registry.markError(providerId, "not_authenticated", 60000);
    return {
      provider: providerId,
      state: "not_authenticated",
      isLoggedIn: false,
      healthScore: 0,
      lastChecked: Date.now(),
      error: error.message,
    };
  }
}

export async function checkSessionHealth(
  providerId: SessionProviderId,
  registry: SessionRegistry
): Promise<HealthCheckResult> {
  const entry = registry.get(providerId);
  
  if (!entry || !entry.enabled) {
    return {
      provider: providerId,
      state: "disabled",
      isLoggedIn: false,
      healthScore: 0,
      lastChecked: Date.now(),
      error: "Session not enabled",
    };
  }
  
  const now = Date.now();
  const lastChecked = entry.lastChecked || 0;
  
  if (now - lastChecked < 60000) {
    return {
      provider: providerId,
      state: entry.state,
      isLoggedIn: entry.state === "ok",
      healthScore: entry.healthScore,
      lastChecked,
    };
  }
  
  return checkSingleSession(providerId, registry);
}

export async function checkAllSessions(
  registry: SessionRegistry
): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];
  const entries = registry.list();
  
  for (const entry of entries) {
    if (entry.enabled) {
      const result = await checkSingleSession(entry.id, registry);
      results.push(result);
    }
  }
  
  return results;
}

export function getHealthySession(
  registry: SessionRegistry,
  preferredOrder: SessionProviderId[] = ["chatgpt_web", "qwen_web", "deepseek_web", "grok_web"]
): SessionProviderId | null {
  for (const providerId of preferredOrder) {
    if (registry.isAvailable(providerId)) {
      return providerId;
    }
  }
  
  return null;
}