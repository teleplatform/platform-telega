import { chromium, Browser, Page, BrowserContext } from "playwright";
import path from "node:path";
import type { SessionProviderId, SessionState } from "./session-registry.js";

export interface SessionBridgeResult {
  success: boolean;
  provider: SessionProviderId;
  session_state: SessionState;
  
  submit_status?: "sent" | "failed";
  response_status?: "received" | "timeout" | "parse_failed";
  
  output_text?: string;
  error_code?: string;
  trace_id: string;
  evidence?: string[];
  duration_ms: number;
}

export type SessionFailureCode = 
  | "session_not_enabled"
  | "session_not_authenticated"
  | "session_expired"
  | "captcha_required"
  | "provider_ui_changed"
  | "submit_failed"
  | "response_timeout"
  | "response_parse_failed"
  | "browser_launch_failed"
  | "policy_denied";

export interface WebAdapter {
  readonly providerId: SessionProviderId;
  readonly loginUrl: string;
  readonly inputSelector: string;
  readonly submitSelector: string;
  readonly outputSelector: string;
  readonly loadingSelector: string;
  readonly maxRetries: number;
  
  navigate(page: Page): Promise<void>;
  fillPrompt(page: Page, prompt: string): Promise<void>;
  submit(page: Page): Promise<void>;
  waitForResponse(page: Page): Promise<string>;
  isLoggedIn(page: Page): Promise<boolean>;
}

export interface BrowserRuntimeConfig {
  headless?: boolean;
  timeoutMs?: number;
  profilePath?: string;
  cookiePath?: string;
}

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_HEADLESS = true;
const DEFAULT_RESPONSE_TIMEOUT_MS = Number(process.env.CREATOR_BRIDGE_EXEC_TIMEOUT_MS) || 120000;

const getCreatorProfileDir = (providerId: SessionProviderId): string => {
  const HOME = process.env.HOME || "";
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

const providerProfilePaths: Record<SessionProviderId, string> = {
  chatgpt_web: getCreatorProfileDir("chatgpt_web"),
  qwen_web: getCreatorProfileDir("qwen_web"),
  deepseek_web: getCreatorProfileDir("deepseek_web"),
  grok_web: getCreatorProfileDir("grok_web"),
  kimi_web: getCreatorProfileDir("kimi_web"),
  perplexity_web: getCreatorProfileDir("perplexity_web"),
  claude_web: getCreatorProfileDir("claude_web"),
  gemini_web: getCreatorProfileDir("gemini_web"),
};

class ManagedBrowser {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: BrowserRuntimeConfig;
  private providerId: SessionProviderId | null = null;

  constructor(config: BrowserRuntimeConfig = {}, providerId?: SessionProviderId) {
    this.config = {
      headless: DEFAULT_HEADLESS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      ...config,
    };
    this.providerId = providerId || null;
  }

  async launch(): Promise<void> {
    if (this.browser) return;
    
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: ["--no-sandbox"],
    });
  }

  async createContext(providerId: SessionProviderId): Promise<BrowserContext> {
    if (!this.browser) {
      await this.launch();
    }
    
    if (this.context) {
      await this.context.close();
    }
    
    const profilePath = providerProfilePaths[providerId];
    
    if (profilePath) {
      this.context = await chromium.launchPersistentContext(profilePath, {
        viewport: { width: 1440, height: 900 },
        args: [
          "--disable-blink-features=AutomationControlled",
          "--disable-dev-shm-usage",
          "--no-sandbox",
        ],
      });
    } else {
      this.context = await this.browser!.newContext();
    }
    
    return this.context;
  }

  async getPage(providerId: SessionProviderId): Promise<Page> {
    if (!this.context) {
      await this.createContext(providerId);
    }
    
    const pages = this.context!.pages();
    if (pages.length > 0) {
      this.page = pages[0];
    } else {
      this.page = await this.context!.newPage();
    }
    
    return this.page;
  }

  async navigate(providerId: SessionProviderId, url: string): Promise<Page> {
    const page = await this.getPage(providerId);
    await page.goto(url, { timeout: this.config.timeoutMs });
    return page;
  }

  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  isActive(): boolean {
    return this.browser !== null && this.context !== null;
  }
}

let browserInstance: ManagedBrowser | null = null;

export function getManagedBrowser(config?: BrowserRuntimeConfig): ManagedBrowser {
  if (!browserInstance) {
    browserInstance = new ManagedBrowser(config);
  }
  return browserInstance;
}

async function executeWithCDP(prompt: string, traceId: string): Promise<SessionBridgeResult> {
  const startTime = Date.now();
  
  let cdpBaseUrl = "http://127.0.0.1:9222";
  if (process.env.CDP_ENDPOINT) {
    const match = process.env.CDP_ENDPOINT.match(/^ws?:\/\/([^:\/]+)(?::(\d+))?/);
    if (match) {
      cdpBaseUrl = `http://${match[1]}:${match[2] || 9222}`;
    }
  }
  
  const CDP_URL = cdpBaseUrl;
  const evidence: string[] = [];
  
  console.log(`[creator-bridge] execution_started: openai_web`);
  console.log(`[creator-bridge] CDP_URL: ${CDP_URL}`);
  
  try {
    const browser = await chromium.connectOverCDP(CDP_URL);
    const contexts = browser.contexts();
    
    if (!contexts.length) {
      console.log(`[creator-bridge] execution_failed: no_cdp_contexts`);
      return {
        success: false,
        provider: "chatgpt_web",
        session_state: "not_authenticated",
        error_code: "no_cdp_contexts",
        trace_id: traceId,
        evidence,
        duration_ms: Date.now() - startTime,
      };
    }
    
    const context = contexts[0];
    console.log(`[creator-bridge] CDP contexts: ${contexts.length}`);
    
    const allPages = context.pages();
    console.log(`[creator-bridge] Total pages: ${allPages.length}`);
    for (const p of allPages) {
      console.log(`[creator-bridge] Page URL: ${p.url()}`);
    }
    
    // Find ChatGPT page - be more explicit
    const chatGptPage = context.pages().find(p => 
      p.url().includes("chatgpt.com") || 
      p.url().includes("chat.openai.com")
    );
    
    let page = chatGptPage;
    
    if (!page) {
      console.log("[creator-bridge] No ChatGPT page found, creating new one");
      page = await context.newPage();
      await page.goto("https://chatgpt.com", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    } else {
      console.log(`[creator-bridge] Found existing ChatGPT page: ${page.url()}`);
    }
    
    console.log(`[creator-bridge] browser_url: ${page.url()}`);
    evidence.push(`url:${page.url()}`);
    
    await page.bringToFront();
    
    // Wait for page to fully load
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    
    // Try multiple selector strategies for input
    const inputSelectors = [
      'textarea[id="prompt-textarea"]',
      'div[contenteditable="true"]',
      'textarea[placeholder*="message"]',
      '[data-testid="composer-input"]'
    ];
    
    let inputLocator: ReturnType<typeof page.locator> | null = null;
    let inputFound = false;
    
    for (const selector of inputSelectors) {
      const locator = page.locator(selector);
      const count = await locator.count();
      if (count > 0) {
        inputLocator = locator;
        inputFound = true;
        console.log(`[creator-bridge] input_selector_found: ${selector} (count=${count})`);
        break;
      }
    }
    
    if (!inputFound || !inputLocator) {
      console.log(`[creator-bridge] execution_failed: input_selector_not_found`);
      return {
        success: false,
        provider: "chatgpt_web",
        session_state: "blocked",
        error_code: "input_selector_not_found",
        trace_id: traceId,
        evidence,
        duration_ms: Date.now() - startTime,
      };
    }
    
    // Click to focus the input (required for React)
    await inputLocator.click({ force: true });
    await page.waitForTimeout(500);
    
    // Clear any existing text
    await inputLocator.fill("");
    await page.waitForTimeout(200);
    
    // Type the prompt character by character
    await inputLocator.type(prompt, { delay: 10 });
    console.log("[creator-bridge] typing prompt...");
    evidence.push("prompt_typed");
    
    // Press ENTER to submit (more reliable than clicking send button)
    await inputLocator.press("Enter");
    console.log("[creator-bridge] ENTER pressed");
    evidence.push("submit:enter");
    
    console.log(`[creator-bridge] response_wait_started: timeout=${DEFAULT_RESPONSE_TIMEOUT_MS}ms`);
    
    // Wait for last assistant message to have visible content (polling approach)
    const responseWaitStart = Date.now();
    let outputText = "";
    let responseReceived = false;
    
    while ((Date.now() - responseWaitStart) < DEFAULT_RESPONSE_TIMEOUT_MS) {
      await page.waitForTimeout(3000);
      
      const messages = await page.evaluate(() => {
        const msgs = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
        const last = msgs[msgs.length - 1] as HTMLElement | undefined;
        return last ? (last.innerText || last?.textContent || "").trim() : "";
      });
      
      if (messages.length > 0) {
        outputText = messages;
        console.log(`[creator-bridge] response_wait: got ${messages.length} chars after ${Date.now() - responseWaitStart}ms`);
        responseReceived = true;
        break;
      }
    }
    
    if (!responseReceived) {
      console.log(`[creator-bridge] execution_timeout: no_response`);
      await browser.close();
      return {
        success: false,
        provider: "chatgpt_web",
        session_state: "unknown",
        submit_status: "sent",
        response_status: "timeout",
        error_code: "no_response",
        trace_id: traceId,
        evidence,
        duration_ms: Date.now() - startTime,
      };
    }
    
    console.log(`[creator-bridge] extraction_success: ${outputText.length} chars`);
    
    if (!outputText.trim()) {
      throw new Error("EMPTY_CHATGPT_EXTRACTION");
    }
    
    evidence.push(`output_text_length:${outputText.length}`);
    evidence.push("response:received");
    
    await browser.close();
    
    return {
      success: true,
      provider: "chatgpt_web",
      session_state: "ok",
      submit_status: "sent",
      response_status: "received",
      output_text: outputText,
      trace_id: traceId,
      evidence,
      duration_ms: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error("[creator-bridge] REAL_EXECUTION_ERROR", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      cause: error?.cause,
    });
    console.log(`[creator-bridge] execution_failed: ${error.message}`);
    return {
      success: false,
      provider: "chatgpt_web",
      session_state: "blocked",
      error_code: error.message || "cdp_execution_error",
      trace_id: traceId,
      evidence,
      duration_ms: Date.now() - startTime,
    };
  }
}

async function executeQwenWithCDP(prompt: string, traceId: string): Promise<SessionBridgeResult> {
  const startTime = Date.now();
  
  let cdpBaseUrl = "http://127.0.0.1:9222";
  if (process.env.CDP_ENDPOINT) {
    const match = process.env.CDP_ENDPOINT.match(/^ws?:\/\/([^:\/]+)(?::(\d+))?/);
    if (match) {
      cdpBaseUrl = `http://${match[1]}:${match[2] || 9222}`;
    }
  }
  
  const CDP_URL = cdpBaseUrl;
  const evidence: string[] = [];
  
  console.log(`[creator-bridge] execution_started: qwen_web`);
  console.log(`[creator-bridge] CDP_URL: ${CDP_URL}`);
  
  try {
    const browser = await chromium.connectOverCDP(CDP_URL);
    const contexts = browser.contexts();
    
    if (!contexts.length) {
      console.log(`[creator-bridge] execution_failed: no_cdp_contexts`);
      return {
        success: false,
        provider: "qwen_web",
        session_state: "not_authenticated",
        error_code: "no_cdp_contexts",
        trace_id: traceId,
        evidence,
        duration_ms: Date.now() - startTime,
      };
    }
    
    const context = contexts[0];
    console.log(`[creator-bridge] CDP contexts: ${contexts.length}`);
    
    // Find Qwen page
    const qwenPage = context.pages().find(p => 
      p.url().includes("qianwen.aliyun.com") || 
      p.url().includes("chat.qwen.ai")
    );
    
    let page = qwenPage;
    
    if (!page) {
      console.log("[creator-bridge] No Qwen page found, creating new one");
      page = await context.newPage();
      await page.goto("https://chat.qwen.ai", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    } else {
      console.log(`[creator-bridge] Found existing Qwen page: ${page.url()}`);
    }
    
    console.log(`[creator-bridge] browser_url: ${page.url()}`);
    evidence.push(`url:${page.url()}`);
    
    await page.bringToFront();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    
    // Qwen input selectors
    const inputSelectors = [
      'textarea[placeholder*="输入"]',
      'textarea',
      'div[contenteditable="true"]',
    ];
    
    let inputLocator: ReturnType<typeof page.locator> | null = null;
    let inputFound = false;
    
    for (const selector of inputSelectors) {
      const locator = page.locator(selector);
      const count = await locator.count();
      if (count > 0) {
        inputLocator = locator;
        inputFound = true;
        console.log(`[creator-bridge] input_selector_found: ${selector} (count=${count})`);
        break;
      }
    }
    
    if (!inputFound || !inputLocator) {
      console.log(`[creator-bridge] execution_failed: input_selector_not_found`);
      return {
        success: false,
        provider: "qwen_web",
        session_state: "blocked",
        error_code: "input_selector_not_found",
        trace_id: traceId,
        evidence,
        duration_ms: Date.now() - startTime,
      };
    }
    
    await inputLocator.click({ force: true });
    await page.waitForTimeout(500);
    await inputLocator.fill("");
    await page.waitForTimeout(200);
    
    await inputLocator.type(prompt, { delay: 10 });
    console.log("[creator-bridge] typing prompt...");
    evidence.push("prompt_typed");
    
    await inputLocator.press("Enter");
    console.log("[creator-bridge] ENTER pressed");
    evidence.push("submit:enter");
    
    console.log(`[creator-bridge] response_wait_started: timeout=${DEFAULT_RESPONSE_TIMEOUT_MS}ms`);
    
    const responseWaitStart = Date.now();
    let outputText = "";
    let responseReceived = false;
    
    while ((Date.now() - responseWaitStart) < DEFAULT_RESPONSE_TIMEOUT_MS) {
      await page.waitForTimeout(3000);
      
      const messages = await page.evaluate(() => {
        const msgs = Array.from(document.querySelectorAll('[class*="message-assistant"]'));
        const last = msgs[msgs.length - 1] as HTMLElement | undefined;
        return last ? (last.innerText || last?.textContent || "").trim() : "";
      });
      
      if (messages.length > 0) {
        outputText = messages;
        console.log(`[creator-bridge] response_wait: got ${messages.length} chars after ${Date.now() - responseWaitStart}ms`);
        responseReceived = true;
        break;
      }
    }
    
    if (!responseReceived) {
      console.log(`[creator-bridge] execution_timeout: no_response`);
      await browser.close();
      return {
        success: false,
        provider: "qwen_web",
        session_state: "unknown",
        submit_status: "sent",
        response_status: "timeout",
        error_code: "no_response",
        trace_id: traceId,
        evidence,
        duration_ms: Date.now() - startTime,
      };
    }
    
    console.log(`[creator-bridge] extraction_success: ${outputText.length} chars`);
    
    if (!outputText.trim()) {
      throw new Error("EMPTY_QWEN_EXTRACTION");
    }
    
    evidence.push(`output_text_length:${outputText.length}`);
    evidence.push("response:received");
    
    await browser.close();
    
    return {
      success: true,
      provider: "qwen_web",
      session_state: "ok",
      submit_status: "sent",
      response_status: "received",
      output_text: outputText,
      trace_id: traceId,
      evidence,
      duration_ms: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error("[creator-bridge] QWEN_EXECUTION_ERROR", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    console.log(`[creator-bridge] execution_failed: ${error.message}`);
    return {
      success: false,
      provider: "qwen_web",
      session_state: "blocked",
      error_code: error.message || "qwen_cdp_execution_error",
      trace_id: traceId,
      evidence,
      duration_ms: Date.now() - startTime,
    };
  }
}

async function executeDeepSeekWithCDP(prompt: string, traceId: string): Promise<SessionBridgeResult> {
  const startTime = Date.now();
  
  let cdpBaseUrl = "http://127.0.0.1:9222";
  if (process.env.CDP_ENDPOINT) {
    const match = process.env.CDP_ENDPOINT.match(/^ws?:\/\/([^:\/]+)(?::(\d+))?/);
    if (match) {
      cdpBaseUrl = `http://${match[1]}:${match[2] || 9222}`;
    }
  }
  
  const CDP_URL = cdpBaseUrl;
  const evidence: string[] = [];
  
  console.log(`[creator-bridge] execution_started: deepseek_web`);
  console.log(`[creator-bridge] CDP_URL: ${CDP_URL}`);
  
  try {
    const browser = await chromium.connectOverCDP(CDP_URL);
    const contexts = browser.contexts();
    
    if (!contexts.length) {
      console.log(`[creator-bridge] execution_failed: no_cdp_contexts`);
      return {
        success: false,
        provider: "deepseek_web",
        session_state: "not_authenticated",
        error_code: "no_cdp_contexts",
        trace_id: traceId,
        evidence,
        duration_ms: Date.now() - startTime,
      };
    }
    
    const context = contexts[0];
    console.log(`[creator-bridge] CDP contexts: ${contexts.length}`);
    
    // Find DeepSeek page
    const deepseekPage = context.pages().find(p => 
      p.url().includes("deepseek.com")
    );
    
    let page = deepseekPage;
    
    if (!page) {
      console.log("[creator-bridge] No DeepSeek page found, creating new one");
      page = await context.newPage();
      await page.goto("https://chat.deepseek.com", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    } else {
      console.log(`[creator-bridge] Found existing DeepSeek page: ${page.url()}`);
    }
    
    console.log(`[creator-bridge] browser_url: ${page.url()}`);
    evidence.push(`url:${page.url()}`);
    
    await page.bringToFront();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    
    // DeepSeek input selectors
    const inputSelectors = [
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="message"]',
      'textarea',
      'div[contenteditable="true"]',
    ];
    
    let inputLocator: ReturnType<typeof page.locator> | null = null;
    let inputFound = false;
    
    for (const selector of inputSelectors) {
      const locator = page.locator(selector);
      const count = await locator.count();
      if (count > 0) {
        inputLocator = locator;
        inputFound = true;
        console.log(`[creator-bridge] input_selector_found: ${selector} (count=${count})`);
        break;
      }
    }
    
    if (!inputFound || !inputLocator) {
      console.log(`[creator-bridge] execution_failed: input_selector_not_found`);
      return {
        success: false,
        provider: "deepseek_web",
        session_state: "blocked",
        error_code: "input_selector_not_found",
        trace_id: traceId,
        evidence,
        duration_ms: Date.now() - startTime,
      };
    }
    
    await inputLocator.click({ force: true });
    await page.waitForTimeout(500);
    await inputLocator.fill("");
    await page.waitForTimeout(200);
    
    await inputLocator.type(prompt, { delay: 10 });
    console.log("[creator-bridge] typing prompt...");
    evidence.push("prompt_typed");
    
    await inputLocator.press("Enter");
    console.log("[creator-bridge] ENTER pressed");
    evidence.push("submit:enter");
    
    console.log(`[creator-bridge] response_wait_started: timeout=${DEFAULT_RESPONSE_TIMEOUT_MS}ms`);
    
    const responseWaitStart = Date.now();
    let outputText = "";
    let responseReceived = false;
    
    while ((Date.now() - responseWaitStart) < DEFAULT_RESPONSE_TIMEOUT_MS) {
      await page.waitForTimeout(3000);
      
      const messages = await page.evaluate(() => {
        const msgs = Array.from(document.querySelectorAll('[class*="message"]'));
        const assistantMsgs = msgs.filter((m: Element) => {
          const text = m.textContent || "";
          return text.length > 20 && !m.querySelector('input, textarea, button');
        });
        const last = assistantMsgs[assistantMsgs.length - 1] as HTMLElement | undefined;
        return last ? (last.innerText || last?.textContent || "").trim() : "";
      });
      
      if (messages.length > 0) {
        outputText = messages;
        console.log(`[creator-bridge] response_wait: got ${messages.length} chars after ${Date.now() - responseWaitStart}ms`);
        responseReceived = true;
        break;
      }
    }
    
    if (!responseReceived) {
      console.log(`[creator-bridge] execution_timeout: no_response`);
      await browser.close();
      return {
        success: false,
        provider: "deepseek_web",
        session_state: "unknown",
        submit_status: "sent",
        response_status: "timeout",
        error_code: "no_response",
        trace_id: traceId,
        evidence,
        duration_ms: Date.now() - startTime,
      };
    }
    
    console.log(`[creator-bridge] extraction_success: ${outputText.length} chars`);
    
    if (!outputText.trim()) {
      throw new Error("EMPTY_DEEPSEEK_EXTRACTION");
    }
    
    evidence.push(`output_text_length:${outputText.length}`);
    evidence.push("response:received");
    
    await browser.close();
    
    return {
      success: true,
      provider: "deepseek_web",
      session_state: "ok",
      submit_status: "sent",
      response_status: "received",
      output_text: outputText,
      trace_id: traceId,
      evidence,
      duration_ms: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error("[creator-bridge] DEEPSEEK_EXECUTION_ERROR", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    console.log(`[creator-bridge] execution_failed: ${error.message}`);
    return {
      success: false,
      provider: "deepseek_web",
      session_state: "blocked",
      error_code: error.message || "deepseek_cdp_execution_error",
      trace_id: traceId,
      evidence,
      duration_ms: Date.now() - startTime,
    };
  }
}

async function executeGrokWithCDP(prompt: string, traceId: string): Promise<SessionBridgeResult> {
  const startTime = Date.now();
  
  let cdpBaseUrl = "http://127.0.0.1:9222";
  if (process.env.CDP_ENDPOINT) {
    const match = process.env.CDP_ENDPOINT.match(/^ws?:\/\/([^:\/]+)(?::(\d+))?/);
    if (match) {
      cdpBaseUrl = `http://${match[1]}:${match[2] || 9222}`;
    }
  }
  
  const CDP_URL = cdpBaseUrl;
  const evidence: string[] = [];
  
  console.log(`[creator-bridge] execution_started: grok_web`);
  console.log(`[creator-bridge] CDP_URL: ${CDP_URL}`);
  
  try {
    const browser = await chromium.connectOverCDP(CDP_URL);
    const contexts = browser.contexts();
    
    if (!contexts.length) {
      console.log(`[creator-bridge] execution_failed: no_cdp_contexts`);
      return {
        success: false,
        provider: "grok_web",
        session_state: "not_authenticated",
        error_code: "no_cdp_contexts",
        trace_id: traceId,
        evidence,
        duration_ms: Date.now() - startTime,
      };
    }
    
    const context = contexts[0];
    console.log(`[creator-bridge] CDP contexts: ${contexts.length}`);
    
    // Find Grok page
    const grokPage = context.pages().find(p => 
      p.url().includes("grok.com") || 
      p.url().includes("x.com/i/grok")
    );
    
    let page = grokPage;
    
    if (!page) {
      console.log("[creator-bridge] No Grok page found, creating new one");
      page = await context.newPage();
      await page.goto("https://grok.com", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    } else {
      console.log(`[creator-bridge] Found existing Grok page: ${page.url()}`);
    }
    
    console.log(`[creator-bridge] browser_url: ${page.url()}`);
    evidence.push(`url:${page.url()}`);
    
    await page.bringToFront();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    
    // Grok input selectors - be more specific to avoid hidden elements
    const inputSelectors = [
      'textarea:not([aria-hidden="true"])',
      'textarea[aria-hidden="false"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[ contenteditable="true"]',
    ];
    
    let inputLocator: ReturnType<typeof page.locator> | null = null;
    let inputFound = false;
    
    for (const selector of inputSelectors) {
      const locator = page.locator(selector);
      const count = await locator.count();
      if (count > 0) {
        inputLocator = locator;
        inputFound = true;
        console.log(`[creator-bridge] input_selector_found: ${selector} (count=${count})`);
        break;
      }
    }
    
    if (!inputFound || !inputLocator) {
      console.log(`[creator-bridge] execution_failed: input_selector_not_found`);
      return {
        success: false,
        provider: "grok_web",
        session_state: "blocked",
        error_code: "input_selector_not_found",
        trace_id: traceId,
        evidence,
        duration_ms: Date.now() - startTime,
      };
    }
    
    // Click to focus (required for React)
    await inputLocator.click({ force: true });
    await page.waitForTimeout(500);
    
    // Clear any existing text
    await inputLocator.fill("");
    await page.waitForTimeout(200);
    
    // Type the prompt character by character
    await inputLocator.type(prompt, { delay: 10 });
    console.log("[creator-bridge] typing prompt...");
    evidence.push("prompt_typed");
    
    await inputLocator.press("Enter");
    console.log("[creator-bridge] ENTER pressed");
    evidence.push("submit:enter");
    
    console.log(`[creator-bridge] response_wait_started: timeout=${DEFAULT_RESPONSE_TIMEOUT_MS}ms`);
    
    const responseWaitStart = Date.now();
    let outputText = "";
    let responseReceived = false;
    
    while ((Date.now() - responseWaitStart) < DEFAULT_RESPONSE_TIMEOUT_MS) {
      await page.waitForTimeout(3000);
      
      const messages = await page.evaluate(() => {
        const msgs = Array.from(document.querySelectorAll('[data-testid="message"], [class*="message"], [class*="markdown"], [role="article"]'));
        const last = msgs[msgs.length - 1] as HTMLElement | undefined;
        return last ? (last.innerText || last?.textContent || "").trim() : "";
      });
      
      if (messages.length > 0) {
        outputText = messages;
        console.log(`[creator-bridge] response_wait: got ${messages.length} chars after ${Date.now() - responseWaitStart}ms`);
        responseReceived = true;
        break;
      }
    }
    
    if (!responseReceived) {
      console.log(`[creator-bridge] execution_timeout: no_response`);
      await browser.close();
      return {
        success: false,
        provider: "grok_web",
        session_state: "unknown",
        submit_status: "sent",
        response_status: "timeout",
        error_code: "no_response",
        trace_id: traceId,
        evidence,
        duration_ms: Date.now() - startTime,
      };
    }
    
    console.log(`[creator-bridge] extraction_success: ${outputText.length} chars`);
    
    if (!outputText.trim()) {
      throw new Error("EMPTY_GROK_EXTRACTION");
    }
    
    evidence.push(`output_text_length:${outputText.length}`);
    evidence.push("response:received");
    
    await browser.close();
    
    return {
      success: true,
      provider: "grok_web",
      session_state: "ok",
      submit_status: "sent",
      response_status: "received",
      output_text: outputText,
      trace_id: traceId,
      evidence,
      duration_ms: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error("[creator-bridge] GROK_EXECUTION_ERROR", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    console.log(`[creator-bridge] execution_failed: ${error.message}`);
    return {
      success: false,
      provider: "grok_web",
      session_state: "blocked",
      error_code: error.message || "grok_cdp_execution_error",
      trace_id: traceId,
      evidence,
      duration_ms: Date.now() - startTime,
    };
  }
}

export async function executeWithSession(
  adapter: WebAdapter,
  prompt: string,
  traceId: string,
  config?: BrowserRuntimeConfig
): Promise<SessionBridgeResult> {
  console.log(`[creator-bridge] provider_selected: ${adapter.providerId}`);
  
  // For chatgpt_web, use CDP connection (existing Chrome)
  if (adapter.providerId === "chatgpt_web") {
    console.log("[creator-bridge] using CDP path for chatgpt_web");
    return await executeWithCDP(prompt, traceId);
  }
  
  // For qwen_web, use CDP connection (existing Chrome)
  if (adapter.providerId === "qwen_web") {
    console.log("[creator-bridge] using CDP path for qwen_web");
    return await executeQwenWithCDP(prompt, traceId);
  }
  
  // For deepseek_web, use CDP connection (existing Chrome)
  if (adapter.providerId === "deepseek_web") {
    console.log("[creator-bridge] using CDP path for deepseek_web");
    return await executeDeepSeekWithCDP(prompt, traceId);
  }
  
  // For grok_web, use CDP connection (existing Chrome)
  if (adapter.providerId === "grok_web") {
    console.log("[creator-bridge] using CDP path for grok_web");
    return await executeGrokWithCDP(prompt, traceId);
  }
  
  // For other providers, use ManagedBrowser with profile
  const startTime = Date.now();
  const browser = new ManagedBrowser(config, adapter.providerId);
  const evidence: string[] = [];
  
  let extensionConnected = true;
  let tabDetected = true;
  let domReady = true;
  
  try {
    console.log(`[creator-bridge] extension_connected: ${extensionConnected}`);
    console.log(`[creator-bridge] tab_detected: ${tabDetected}`);
    console.log(`[creator-bridge] dom_ready: ${domReady ? 'partial' : 'false'}`);
    
    const page = await browser.navigate(adapter.providerId, adapter.loginUrl);
    tabDetected = true;
    evidence.push(`navigated:${adapter.loginUrl}`);
    
    const isLogged = await adapter.isLoggedIn(page);
    if (!isLogged) {
      evidence.push("auth_check:failed");
      console.log(`[creator-bridge] execution_failed: session_not_authenticated`);
      return {
        success: false,
        provider: adapter.providerId,
        session_state: "expired",
        submit_status: "failed",
        error_code: "session_not_authenticated",
        trace_id: traceId,
        evidence,
        duration_ms: Date.now() - startTime,
      };
    }
    evidence.push("auth_check:passed");
    
    console.log(`[creator-bridge] execution_started`);
    
    await adapter.fillPrompt(page, prompt);
    evidence.push("prompt_filled");
    
    await adapter.submit(page);
    evidence.push("submit:sent");
    
    const output = await adapter.waitForResponse(page);
    evidence.push("response:received");
    evidence.push(`output_length:${output.length}`);
    
    console.log(`[creator-bridge] execution_success: ${output.length} chars`);
    
    return {
      success: true,
      provider: adapter.providerId,
      session_state: "ok",
      submit_status: "sent",
      response_status: "received",
      output_text: output,
      trace_id: traceId,
      evidence,
      duration_ms: Date.now() - startTime,
    };
  } catch (error: any) {
    let errorState: SessionState = "blocked";
    let errorCode: string = "unknown";
    let responseStatus: "timeout" | "parse_failed" | undefined;
    
    const errorMessage = error.message || "unknown";
    
    if (errorMessage.includes("timeout")) {
      errorState = "rate_limited";
      errorCode = "response_timeout";
      responseStatus = "timeout";
    } else if (errorMessage.includes("captcha")) {
      errorState = "captcha";
      errorCode = "captcha_required";
    } else if (errorMessage.includes("No response found") || errorMessage.includes("parse")) {
      errorCode = "response_parse_failed";
      responseStatus = "parse_failed";
    } else if (errorMessage.includes("click") || errorMessage.includes("submit")) {
      errorCode = "submit_failed";
    }
    
    console.log(`[creator-bridge] execution_failed: ${errorCode}`);
    
    return {
      success: false,
      provider: adapter.providerId,
      session_state: errorState,
      submit_status: errorCode === "submit_failed" ? "failed" : undefined,
      response_status: responseStatus,
      error_code: errorCode,
      trace_id: traceId,
      evidence,
      duration_ms: Date.now() - startTime,
    };
  } finally {
    await browser.close();
  }
}