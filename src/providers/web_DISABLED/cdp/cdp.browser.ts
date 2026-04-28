import { chromium, type Browser, type Page, type BrowserContext } from "playwright";
import type { CDPConnection, CDPBrowserConfig, WebProviderId, SessionHealth, CDPExecutionResult } from "./cdp.types.js";
import { DEFAULT_CDP_PORT, CDP_ENDPOINTS } from "./cdp.types.js";

export class CDPBrowser {
  private connection: CDPConnection | null = null;
  private config: CDPBrowserConfig;
  private currentProvider: WebProviderId | null = null;

  constructor(config: Partial<CDPBrowserConfig> = {}) {
    const customEndpoint = process.env.CDP_ENDPOINT;
    const debugPort = customEndpoint 
      ? parseInt(customEndpoint.match(/.*:(\d+).*/)?.[1] || String(DEFAULT_CDP_PORT))
      : DEFAULT_CDP_PORT;
    
    this.config = {
      debugPort,
      headless: false,
      timeoutMs: 60000,
      ...config,
    };
  }

  async connect(): Promise<CDPConnection> {
    if (this.connection?.connected) {
      return this.connection;
    }

    const endpoint = CDP_ENDPOINTS.chatgpt_web || `http://127.0.0.1:${this.config.debugPort}`;
    console.log(`[CDPBrowser] Connecting to: ${endpoint}`);
    
    try {
      const browser = await chromium.connectOverCDP(endpoint);
      
      this.connection = {
        endpoint,
        browser,
        connected: true,
        connectedAt: Date.now(),
      };
      
      return this.connection;
    } catch (error: any) {
      throw new Error(`CDP connection failed: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection?.browser) {
      await this.connection.browser.close();
      this.connection = null;
    }
  }

  isConnected(): boolean {
    return this.connection?.connected || false;
  }

  getConnection(): CDPConnection | null {
    return this.connection;
  }

  async getOrCreatePage(provider: WebProviderId): Promise<Page> {
    if (!this.connection?.connected) {
      await this.connect();
    }

    const browser = this.connection!.browser;
    const contexts = browser.contexts();
    
    if (!contexts.length) {
      throw new Error("No browser contexts available");
    }

    const context = contexts[0];
    const pages = context.pages();
    
    const providerUrls: Record<WebProviderId, string[]> = {
      chatgpt_web: ["chatgpt.com", "chat.openai.com"],
      qwen_web: ["qwen.ai"],
      deepseek_web: ["chat.deepseek.com"],
    };

    const expectedUrls = providerUrls[provider];
    const existingPage = pages.find((p: Page) => 
      expectedUrls.some(url => p.url().includes(url))
    );

    if (existingPage) {
      await existingPage.bringToFront();
      this.currentProvider = provider;
      return existingPage;
    }

    const newPage = await context.newPage();
    await newPage.goto(this.getLoginUrl(provider), {
      waitUntil: "domcontentloaded",
      timeout: this.config.timeoutMs,
    });
    
    this.currentProvider = provider;
    return newPage;
  }

  getLoginUrl(provider: WebProviderId): string {
    const urls: Record<WebProviderId, string> = {
      chatgpt_web: "https://chatgpt.com",
      qwen_web: "https://qwen.ai",
      deepseek_web: "https://chat.deepseek.com",
    };
    return urls[provider];
  }

  async checkSessionState(page: Page): Promise<SessionHealth> {
    try {
      const html = await page.content();
      const url = page.url();

      const challengeIndicators = [
        "Подтвердите, что вы человек",
        "Verify you are human",
        "Cloudflare",
        "Just a moment",
        "captcha",
        "challenge",
      ];

      if (challengeIndicators.some(indicator => html.includes(indicator))) {
        return "challenge_detected";
      }

      const loginIndicators = [
        "Continue with Google",
        "Log in",
        "Войти",
        "Sign in",
        "/login",
        "/signin",
      ];

      if (loginIndicators.some(indicator => html.includes(indicator) || url.includes(indicator))) {
        return "login_required";
      }

      return "alive";
    } catch (error) {
      return "browser_unreachable";
    }
  }
}

let cdpBrowserInstance: CDPBrowser | null = null;

export function getCDPBrowser(config?: Partial<CDPBrowserConfig>): CDPBrowser {
  if (!cdpBrowserInstance) {
    cdpBrowserInstance = new CDPBrowser(config);
  }
  return cdpBrowserInstance;
}

export function createCDPBrowser(config?: Partial<CDPBrowserConfig>): CDPBrowser {
  return new CDPBrowser(config);
}

function getCdpBaseUrl(): string {
  const customEndpoint = process.env.CDP_ENDPOINT;
  if (!customEndpoint) return "http://127.0.0.1:9222";
  
  const match = customEndpoint.match(/^ws?:\/\/([^:\/]+)(?::(\d+))?/);
  if (match) {
    return `http://${match[1]}:${match[2] || 9222}`;
  }
  return "http://127.0.0.1:9222";
}

export async function createCDPConnection(debugPort: number = DEFAULT_CDP_PORT): Promise<CDPConnection> {
  const endpoint = getCdpBaseUrl();
  
  try {
    console.log(`[createCDPConnection] Connecting to: ${endpoint}`);
    const browser = await chromium.connectOverCDP(endpoint);
    
    return {
      endpoint,
      browser,
      connected: true,
      connectedAt: Date.now(),
    };
  } catch (error: any) {
    throw new Error(`Failed to connect to CDP at ${endpoint}: ${error.message}`);
  }
}