import type { WebExecuteInput, WebExecuteResult, WebProvider, WebProviderHealth } from '../web-provider.types';

function getCdpBaseUrl(): string {
  const customEndpoint = process.env.CDP_ENDPOINT;
  if (!customEndpoint) return "http://127.0.0.1:9222";
  
  const match = customEndpoint.match(/^ws?:\/\/([^:\/]+)(?::(\d+))?/);
  if (match) {
    return `http://${match[1]}:${match[2] || 9222}`;
  }
  return "http://127.0.0.1:9222";
}

const CDP_URL = getCdpBaseUrl();

function getProviderUrlPatterns(provider: WebProvider): string[] {
  if (provider === 'qwen_web') return ['chat.qwen.ai', 'qwen.ai', 'qwen'];
  if (provider === 'deepseek_web') return ['chat.deepseek.com', 'deepseek.com', 'deepseek'];
  console.log(`[cdp.shared] Getting patterns for: ${provider}, returning: chatgpt`);
  return ['chatgpt', 'chat.openai', 'openai', 'chat'];
}

export async function getCdpProviderHealth(
  provider: WebProvider
): Promise<WebProviderHealth> {
  const patterns = getProviderUrlPatterns(provider);
  if (patterns.length === 0) {
    return {
      provider,
      transport: 'cdp',
      ready: false,
      reason: 'unknown_provider',
    };
  }

  try {
    const { chromium } = await import('playwright');
    console.log(`[cdp.shared] Connecting to CDP: ${CDP_URL}`);
    const browser = await chromium.connectOverCDP(CDP_URL);
    const context = browser.contexts()[0];
    
    if (!context) {
      await browser.close();
      return {
        provider,
        transport: 'cdp',
        ready: false,
        reason: 'no_browser_context',
      };
    }

    const pages = context.pages();
    console.log(`[cdp.shared] Found ${pages.length} pages`);
    for (const p of pages) {
      console.log(`[cdp.shared] Page URL: ${p.url()}`);
    }
    
    const page = context.pages().find(p => {
      const pageUrl = p.url();
      console.log(`[cdp.shared] Checking page: ${pageUrl} against patterns: ${JSON.stringify(patterns)}`);
      const found = patterns.some(pat => {
        const matches = pageUrl.includes(pat);
        console.log(`[cdp.shared] Pattern '${pat}' matches: ${matches}`);
        return matches;
      });
      console.log(`[cdp.shared] Final match result: ${found}`);
      return found;
    });

    await browser.close();

    if (!page) {
      return {
        provider,
        transport: 'cdp',
        ready: false,
        reason: 'tab_not_found',
      };
    }

    return {
      provider,
      transport: 'cdp',
      ready: true,
    };
  } catch (error: any) {
    return {
      provider,
      transport: 'cdp',
      ready: false,
      reason: error.message,
    };
  }
}

function getProviderSelectors(provider: WebProvider): { input: string; output: string; sendButton?: string } {
  if (provider === 'qwen_web') {
    return {
      input: 'textarea[placeholder*="输入"], textarea#input-area',
      output: '[class*="message-content"], .assistant-message, [class*="response"]',
      sendButton: 'button[type="submit"]',
    };
  }
  if (provider === 'deepseek_web') {
    return {
      input: 'textarea[name="prompt"], textarea#prompt-textarea',
      output: '[class*="message-content"], .assistant-message, [class*="response"]',
      sendButton: 'button[type="submit"]',
    };
  }
  return {
      input: 'textarea#prompt-textarea, textarea[name="prompt"], div[contenteditable="true"]',
      output: '[data-message-author-role="assistant"]',
      sendButton: 'button[data-testid="send-button"]',
    };
}

function findOutputElement(page: any, selector: string): Promise<string | null> {
  return page.locator(selector).last().textContent().catch(() => null);
}

async function waitForStableResponse(
  page: any,
  selectors: { input: string; output: string; sendButton?: string },
  timeoutMs: number,
  stableMs: number = 2500
): Promise<{ ok: boolean; text?: string; reason?: string }> {
  const startedAt = Date.now();
  let lastText = '';
  let lastChangeAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const current = await findOutputElement(page, selectors.output);
    
    if (current && current !== lastText) {
      lastText = current;
      lastChangeAt = Date.now();
    }

    const isStreaming = await page.locator('[data-testid="stop-button"], button:has-text("Stop"), button:has-text("Остановить")').count().catch(() => 0);

    if (current && !isStreaming && Date.now() - lastChangeAt >= stableMs) {
      return { ok: true, text: current };
    }

    await page.waitForTimeout(700);
  }

  return {
    ok: false,
    reason: 'response_timeout',
    text: lastText || undefined,
  };
}

export async function executeCdpPrompt(
  input: WebExecuteInput
): Promise<WebExecuteResult> {
  const startTime = Date.now();
  const patterns = getProviderUrlPatterns(input.provider);

  if (patterns.length === 0) {
    return {
      ok: false,
      provider: input.provider,
      transport: 'cdp',
      reason: 'unknown_provider',
      duration_ms: Date.now() - startTime,
    };
  }

  const selectors = getProviderSelectors(input.provider);
  const timeoutMs = input.timeoutMs ?? 60000;
  const cdpUrl = getCdpBaseUrl();

  try {
    const { chromium } = await import('playwright');
    console.log(`[cdp.shared execute] Using CDP: ${cdpUrl}`);
    const browser = await chromium.connectOverCDP(cdpUrl);
    const context = browser.contexts()[0];

    if (!context) {
      await browser.close();
      return {
        ok: false,
        provider: input.provider,
        transport: 'cdp',
        reason: 'no_browser_context',
        duration_ms: Date.now() - startTime,
      };
    }

    const page = context.pages().find(p => 
      patterns.some(pat => p.url().includes(pat))
    );

    if (!page) {
      await browser.close();
      return {
        ok: false,
        provider: input.provider,
        transport: 'cdp',
        reason: 'tab_not_found',
        duration_ms: Date.now() - startTime,
      };
    }

    // await page.bringToFront(); // Skip to avoid focusing browser window

    const textarea = page.locator(selectors.input).first();

    try {
      await textarea.waitFor({ state: 'attached', timeout: 5000 });
    } catch {
      await browser.close();
      return {
        ok: false,
        provider: input.provider,
        transport: 'cdp',
        reason: 'input_not_found',
        duration_ms: Date.now() - startTime,
      };
    }

    await textarea.click().catch(() => {});
    await textarea.focus().catch(() => {});
    await textarea.fill(input.prompt);
    await textarea.click().catch(() => {});

    if (selectors.sendButton) {
      const sendButton = page.locator(selectors.sendButton).first();
      const btnVisible = await sendButton.isVisible().catch(() => false);
      if (btnVisible) {
        await sendButton.click();
      } else {
        await textarea.press('Enter').catch(async () => {
          await page.keyboard.press('Enter');
        });
      }
    } else {
      await textarea.press('Enter').catch(async () => {
        await page.keyboard.press('Enter');
      });
    }

    const responseResult = await waitForStableResponse(page, selectors, timeoutMs);

    await browser.close();

    return {
      ok: responseResult.ok,
      provider: input.provider,
      transport: 'cdp',
      responseText: responseResult.text ?? undefined,
      reason: responseResult.reason,
      duration_ms: Date.now() - startTime,
    };

  } catch (error: any) {
    return {
      ok: false,
      provider: input.provider,
      transport: 'cdp',
      reason: error.message,
      duration_ms: Date.now() - startTime,
    };
  }
}

function extractResponseFromPage(pageText: string, provider: WebProvider): string {
  const lines = pageText.split('\n').filter(l => l.trim());
  
  if (provider === 'qwen_web') {
    const relevant = lines.slice(-10).join('\n');
    return relevant || 'Response received via CDP';
  }
  
  if (provider === 'deepseek_web') {
    const relevant = lines.slice(-10).join('\n');
    return relevant || 'Response received via CDP';
  }

  return 'Response received via CDP';
}