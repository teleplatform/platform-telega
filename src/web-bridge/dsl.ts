import type { Page } from "playwright";

export async function open(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
}

export async function mustWait(page: Page, selector: string, timeoutMs = 20_000) {
  await page.waitForSelector(selector, { timeout: timeoutMs });
}

export async function typeInto(page: Page, selector: string, text: string) {
  await page.fill(selector, text);
}

export async function click(page: Page, selector: string) {
  await page.click(selector);
}

export async function readText(page: Page, selector: string) {
  const t = await page.textContent(selector);
  return (t || "").trim();
}
