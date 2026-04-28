import type { WebProviderId, CDPExecutionResult, SessionHealth } from "./cdp.types.js";
import { getCDPBrowser, createCDPBrowser } from "./cdp.browser.js";
import { getCDPSessionManager } from "./cdp.session.js";
import { getCDPHealthMonitor } from "./cdp.health.js";
import { getCDPProviderRegistry } from "./cdp.registry.js";

export interface CDPGenerateOptions {
  provider?: WebProviderId;
  traceId?: string;
  systemPrompt?: string;
}

export class CDPBridge {
  private defaultProvider: WebProviderId = "chatgpt_web";

  constructor(defaultProvider?: WebProviderId) {
    if (defaultProvider) {
      this.defaultProvider = defaultProvider;
    }
  }

  async generate(prompt: string, options?: CDPGenerateOptions): Promise<CDPExecutionResult> {
    const provider = options?.provider || this.defaultProvider;
    const traceId = options?.traceId || `cdp-${Date.now()}`;
    const startTime = Date.now();
    const evidence: string[] = [];

    const sessionManager = getCDPSessionManager();
    const browser = getCDPBrowser();

    if (!sessionManager.isEnabled(provider)) {
      return {
        success: false,
        provider,
        session_state: "browser_unreachable",
        error_code: "provider_disabled",
        trace_id: traceId,
        evidence: [`provider:${provider}`, "reason:disabled"],
        duration_ms: Date.now() - startTime,
      };
    }

    if (!sessionManager.isHealthy(provider)) {
      const session = sessionManager.get(provider);
      return {
        success: false,
        provider,
        session_state: session?.state || "browser_unreachable",
        error_code: "session_not_healthy",
        trace_id: traceId,
        evidence: [`provider:${provider}`, `state:${session?.state}`],
        duration_ms: Date.now() - startTime,
      };
    }

    try {
      await browser.connect();
      evidence.push("cdp:connected");

      const page = await browser.getOrCreatePage(provider);
      evidence.push(`cdp:page_url:${page.url()}`);

      const state = await browser.checkSessionState(page);
      evidence.push(`cdp:session_state:${state}`);

      if (state !== "alive") {
        sessionManager.markUnhealthy(provider, state);
        return {
          success: false,
          provider,
          session_state: state,
          error_code: `session_state:${state}`,
          trace_id: traceId,
          evidence,
          duration_ms: Date.now() - startTime,
        };
      }

      const adapterConfig = this.getAdapterConfig(provider);
      
      const textarea = page.locator(adapterConfig.inputSelector);
      await textarea.fill(prompt);
      evidence.push("cdp:prompt_filled");

      const submitButton = page.locator(adapterConfig.submitSelector);
      await submitButton.click();
      evidence.push("cdp:submit_clicked");

      await page.waitForTimeout(8000);

      const outputLocator = page.locator(adapterConfig.outputSelector);
      const count = await outputLocator.count();
      evidence.push(`cdp:output_count:${count}`);

      if (count === 0) {
        sessionManager.markUnhealthy(provider, "browser_unreachable", "No response received");
        return {
          success: false,
          provider,
          session_state: "browser_unreachable",
          submit_status: "sent",
          response_status: "timeout",
          error_code: "no_response_received",
          trace_id: traceId,
          evidence,
          duration_ms: Date.now() - startTime,
        };
      }

      const lastOutput = outputLocator.nth(count - 1);
      const outputText = await lastOutput.textContent() || "";
      evidence.push(`cdp:output_length:${outputText.length}`);

      sessionManager.markHealthy(provider);

      return {
        success: true,
        provider,
        session_state: "alive",
        submit_status: "sent",
        response_status: "received",
        output_text: outputText,
        trace_id: traceId,
        evidence,
        duration_ms: Date.now() - startTime,
      };
    } catch (error: any) {
      sessionManager.markUnhealthy(provider, "browser_unreachable", error.message);
      
      return {
        success: false,
        provider,
        session_state: "browser_unreachable",
        error_code: error.message || "cdp_execution_error",
        trace_id: traceId,
        evidence,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  private getAdapterConfig(provider: WebProviderId) {
    const configs = {
      openai_web: {
        inputSelector: 'textarea[id="prompt-textarea"]',
        submitSelector: 'button[data-testid="send-button"]',
        outputSelector: '[data-message-author-role="assistant"]',
      },
      qwen_web: {
        inputSelector: 'textarea[placeholder*="输入"]',
        submitSelector: 'button[type="submit"]',
        outputSelector: '.assistant-message, [class*="response"]',
      },
      deepseek_web: {
        inputSelector: 'textarea[name="prompt"]',
        submitSelector: 'button[type="submit"]',
        outputSelector: '.assistant-message, [class*="message"]',
      },
    };
    return configs[provider];
  }

  async healthCheck(provider?: WebProviderId) {
    const monitor = getCDPHealthMonitor();
    if (provider) {
      return await monitor.check(provider);
    }
    return await monitor.checkAll();
  }

  getBestProvider(): WebProviderId | null {
    const sessionManager = getCDPSessionManager();
    return sessionManager.getHealthy();
  }

  async connect(): Promise<void> {
    const browser = getCDPBrowser();
    await browser.connect();
  }

  async disconnect(): Promise<void> {
    const browser = getCDPBrowser();
    await browser.disconnect();
  }

  isConnected(): boolean {
    const browser = getCDPBrowser();
    return browser.isConnected();
  }
}

let cdpBridgeInstance: CDPBridge | null = null;

export function getCDPBridge(provider?: WebProviderId): CDPBridge {
  if (!cdpBridgeInstance) {
    cdpBridgeInstance = new CDPBridge(provider);
  }
  return cdpBridgeInstance;
}

export function createCDPBridge(provider?: WebProviderId): CDPBridge {
  return new CDPBridge(provider);
}