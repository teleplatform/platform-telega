import { chromium, Browser, BrowserContext, Page } from "playwright";
import { decryptFromFile, encryptToFile, hasVaultSession, vaultPath } from "./vault";

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser) return browser;
  browser = await chromium.launch({ headless: true });
  return browser;
}

export async function withSessionPage<T>(
  provider: string,
  fn: (page: Page) => Promise<T>
): Promise<T> {
  const b = await getBrowser();
  const storage = decryptFromFile<any>(vaultPath(provider));
  const ctx: BrowserContext = await b.newContext({ storageState: storage });
  const page = await ctx.newPage();

  try {
    return await fn(page);
  } finally {
    await ctx.close();
  }
}

export async function shutdownBrowserd() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export type WebProvider = "chatgpt_web" | "qwen_web" | "deepseek_web";

const LOGIN_URL: Record<WebProvider, string> = {
  chatgpt_web: "https://chatgpt.com/",
  qwen_web: "https://chat.qwen.ai/",
  deepseek_web: "https://chat.deepseek.com/",
};

export async function headfulLoginAndSave(provider: WebProvider) {
  const out = vaultPath(provider);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(LOGIN_URL[provider], { waitUntil: "domcontentloaded" });

  process.stdout.write(
    `\n[tele-gpt] Login manually for ${provider}, then press Enter here to save session...\n`
  );
  await new Promise<void>((res) => process.stdin.once("data", () => res()));

  const storage = await context.storageState();
  encryptToFile(out, storage);

  await context.close();
  await browser.close();

  return { ok: true as const, saved: out };
}

export async function loadStorageState(provider: WebProvider) {
  if (!hasVaultSession(provider)) {
    return { ok: false as const, error: "no_session" };
  }
  try {
    const storage = decryptFromFile<any>(vaultPath(provider));
    return { ok: true as const, storage };
  } catch (e: any) {
    return { ok: false as const, error: "vault_decrypt_failed", details: String(e?.message || e) };
  }
}
