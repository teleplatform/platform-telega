import { type Browser, type BrowserContext } from "playwright";

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
];

let agentIndex = 0;

function nextUserAgent(): string {
  const ua = USER_AGENTS[agentIndex % USER_AGENTS.length];
  agentIndex++;
  return ua;
}

export async function createIsolatedContext(browser: Browser, label: string): Promise<BrowserContext> {
  const ua = nextUserAgent();

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: ua,
    locale: "en-US",
    timezoneId: "America/New_York",
    colorScheme: "light",
    reducedMotion: "no-preference",
    deviceScaleFactor: 2,
    bypassCSP: true,
    ignoreHTTPSErrors: false,
  });

  return context;
}

export function getIsolationSummary(): string {
  return `User agents: ${USER_AGENTS.length} rotating, next index: ${agentIndex}`;
}
