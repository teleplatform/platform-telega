import type { Action } from "../execution/execution-types.js";
import type { BrowserActionResult } from "./browser-types.js";
import { getBrowserSession } from "./browser-session.js";
import fs from "node:fs";
import path from "node:path";

const SCREENSHOT_DIR = ".data/runtime/browser";

function ensureScreenshotDir(): string {
  const dir = path.join(process.cwd(), SCREENSHOT_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function executeBrowserNavigate(action: Action): Promise<BrowserActionResult> {
  const { url, timeoutMs = 30000 } = action.params as Record<string, any>;
  if (!url) throw new Error("browser_navigate requires url");
  const session = getBrowserSession();
  await session.navigate(String(url), Number(timeoutMs));
  const page = await (await import("./browser-session.js")).getBrowserSession().getPage();
  return { url: page.url(), title: await page.title() };
}

export async function executeBrowserClick(action: Action): Promise<BrowserActionResult> {
  const { selector } = action.params as Record<string, any>;
  if (!selector) throw new Error("browser_click requires selector");
  const session = getBrowserSession();
  const found = await session.click(String(selector));
  const page = await session.getPage();
  return { elementFound: found, url: page.url() };
}

export async function executeBrowserType(action: Action): Promise<BrowserActionResult> {
  const { selector, text } = action.params as Record<string, any>;
  if (!selector || text === undefined) throw new Error("browser_type requires selector and text");
  const session = getBrowserSession();
  const success = await session.type(String(selector), String(text));
  return { elementFound: success };
}

export async function executeBrowserScreenshot(action: Action): Promise<BrowserActionResult> {
  const { label } = action.params as Record<string, any>;
  const session = getBrowserSession();
  const buffer = await session.screenshot();
  const dir = ensureScreenshotDir();
  const filename = `screenshot_${label ?? "capture"}_${Date.now()}.png`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  return { screenshotPath: filePath };
}

export async function executeBrowserExtract(action: Action): Promise<BrowserActionResult> {
  const { selector, type = "text" } = action.params as Record<string, any>;
  const session = getBrowserSession();
  const page = await session.getPage();
  if (type === "html") {
    const html = selector ? await session.extractHtml(String(selector)) : await session.extractHtml();
    return { text: html.slice(0, 10000), url: page.url(), title: await page.title() };
  }
  const text = selector ? await session.extractText(String(selector)) : await session.extractText();
  return { text: text.slice(0, 10000), url: page.url(), title: await page.title() };
}

export async function executeBrowserWait(action: Action): Promise<BrowserActionResult> {
  const { selector, timeoutMs = 10000 } = action.params as Record<string, any>;
  if (!selector) throw new Error("browser_wait requires selector");
  const session = getBrowserSession();
  const found = await session.waitForSelector(String(selector), Number(timeoutMs));
  return { waitResult: found, elementFound: found };
}
