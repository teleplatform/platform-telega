import { chromium, type Browser, type Page, type BrowserContext } from "playwright";
import type { BrowserSessionState } from "./browser-types.js";

class BrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private errorCount = 0;

  async launch(headless = true): Promise<void> {
    if (this.browser) return;
    this.browser = await chromium.launch({
      headless,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    this.page = await this.context.newPage();
  }

  async getPage(): Promise<Page> {
    if (!this.browser) await this.launch();
    if (!this.page || !this.page.isClosed()) {
      if (!this.page || this.page.isClosed()) {
        this.page = await this.context!.newPage();
      }
    }
    return this.page!;
  }

  async navigate(url: string, timeoutMs = 30000): Promise<void> {
    const page = await this.getPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  }

  async click(selector: string): Promise<boolean> {
    const page = await this.getPage();
    try {
      await page.click(selector, { timeout: 5000 });
      return true;
    } catch {
      try {
        await page.locator(selector).first().click({ force: true, timeout: 3000 });
        return true;
      } catch {
        return false;
      }
    }
  }

  async type(selector: string, text: string): Promise<boolean> {
    const page = await this.getPage();
    try {
      await page.locator(selector).first().fill(text, { timeout: 5000 });
      return true;
    } catch {
      try {
        await page.locator(selector).first().click({ force: true, timeout: 2000 });
        await page.keyboard.type(text, { delay: 10 });
        return true;
      } catch {
        return false;
      }
    }
  }

  async screenshot(): Promise<Buffer> {
    const page = await this.getPage();
    return page.screenshot({ type: "png", fullPage: false });
  }

  async extractText(selector?: string): Promise<string> {
    const page = await this.getPage();
    if (selector) {
      try {
        return (await page.locator(selector).first().textContent({ timeout: 3000 })) || "";
      } catch {
        return "";
      }
    }
    return (await page.evaluate(() => document.body?.innerText || "")) || "";
  }

  async extractHtml(selector?: string): Promise<string> {
    const page = await this.getPage();
    if (selector) {
      try {
        const el = page.locator(selector).first();
        return (await el.innerHTML({ timeout: 3000 })) || "";
      } catch {
        return "";
      }
    }
    return (await page.evaluate(() => document.documentElement?.outerHTML?.slice(0, 5000) || "")) || "";
  }

  async waitForSelector(selector: string, timeoutMs = 10000): Promise<boolean> {
    const page = await this.getPage();
    try {
      await page.waitForSelector(selector, { timeout: timeoutMs, state: "visible" });
      return true;
    } catch {
      return false;
    }
  }

  getState(): BrowserSessionState {
    return {
      launched: this.browser !== null,
      pageCount: this.context?.pages().length || 0,
      lastUrl: this.page?.url(),
      errorCount: this.errorCount,
    };
  }

  recordError(): void {
    this.errorCount++;
  }

  async close(): Promise<void> {
    try { await this.page?.close(); } catch {}
    try { await this.context?.close(); } catch {}
    try { await this.browser?.close(); } catch {}
    this.page = null;
    this.context = null;
    this.browser = null;
  }
}

let session: BrowserSession | null = null;

export function getBrowserSession(): BrowserSession {
  if (!session) session = new BrowserSession();
  return session;
}

export async function closeBrowserSession(): Promise<void> {
  if (session) {
    await session.close();
    session = null;
  }
}
