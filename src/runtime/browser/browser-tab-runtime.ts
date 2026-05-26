import type { BrowserActionType, BrowserActionResult } from "./browser-types.js";
import { getSession, getPageForSession } from "./browser-session-manager.js";
import { getResourceLimits } from "./browser-resource-limits.js";

export interface TabInfo {
  sessionId: string;
  index: number;
  url: string;
  title: string;
}

async function withPage<T>(sessionId: string, fn: (page: import("playwright").Page) => Promise<T>): Promise<T> {
  const page = await getPageForSession(sessionId);
  return fn(page);
}

export async function tabNavigate(sessionId: string, url: string, timeoutMs?: number): Promise<BrowserActionResult> {
  const limit = getResourceLimits();
  return withPage(sessionId, async (page) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs ?? limit.taskTimeoutMs });
    return { url: page.url(), title: await page.title() };
  });
}

export async function tabClick(sessionId: string, selector: string): Promise<BrowserActionResult> {
  return withPage(sessionId, async (page) => {
    try {
      await page.click(selector, { timeout: 5000 });
      return { url: page.url(), elementFound: true };
    } catch {
      try {
        await page.locator(selector).first().click({ force: true, timeout: 3000 });
        return { url: page.url(), elementFound: true };
      } catch {
        return { elementFound: false };
      }
    }
  });
}

export async function tabType(sessionId: string, selector: string, text: string): Promise<BrowserActionResult> {
  return withPage(sessionId, async (page) => {
    try {
      await page.locator(selector).first().fill(text, { timeout: 5000 });
      return { elementFound: true };
    } catch {
      try {
        await page.locator(selector).first().click({ force: true, timeout: 2000 });
        await page.keyboard.type(text, { delay: 10 });
        return { elementFound: true };
      } catch {
        return { elementFound: false };
      }
    }
  });
}

export async function tabExtract(sessionId: string, selector?: string): Promise<BrowserActionResult> {
  return withPage(sessionId, async (page) => {
    if (selector) {
      try {
        const text = await page.locator(selector).first().textContent({ timeout: 3000 });
        return { text: text || "", url: page.url(), title: await page.title() };
      } catch {
        return { url: page.url(), title: await page.title() };
      }
    }
    const text = await page.evaluate(() => document.body?.innerText || "");
    return { text: text.slice(0, 10000), url: page.url(), title: await page.title() };
  });
}

export async function tabScreenshot(sessionId: string): Promise<Buffer> {
  return withPage(sessionId, async (page) => {
    return page.screenshot({ type: "png" });
  });
}

export async function tabWaitForSelector(sessionId: string, selector: string, timeoutMs = 10000): Promise<BrowserActionResult> {
  return withPage(sessionId, async (page) => {
    try {
      await page.waitForSelector(selector, { timeout: timeoutMs, state: "visible" });
      return { waitResult: true, elementFound: true };
    } catch {
      return { waitResult: false, elementFound: false };
    }
  });
}

export async function openNewTab(sessionId: string): Promise<{ index: number; url: string }> {
  const s = getSession(sessionId);
  if (!s) throw new Error(`Session ${sessionId} not found`);
  const limits = getResourceLimits();
  if (s.pages.length >= limits.maxPagesPerSession) {
    throw new Error(`Tab limit reached: ${limits.maxPagesPerSession}`);
  }
  const page = await s.context.newPage();
  s.pages.push(page);
  return { index: s.pages.length - 1, url: page.url() };
}

export function getTabs(sessionId: string): TabInfo[] {
  const s = getSession(sessionId);
  if (!s) return [];
  return s.context.pages().map((p, i) => ({
    sessionId,
    index: i,
    url: p.url(),
    title: p.url(),
  }));
}

export async function closeTab(sessionId: string, index: number): Promise<void> {
  const s = getSession(sessionId);
  if (!s) return;
  const pages = s.context.pages();
  if (index < pages.length) {
    await pages[index].close();
    s.pages = s.context.pages();
  }
}
