import { chromium, type Browser, type Page, type BrowserContext } from "playwright";
import type { BrowserSessionState } from "./browser-types.js";
import { getResourceLimits } from "./browser-resource-limits.js";
import { createIsolatedContext } from "./browser-session-isolation.js";

export interface ManagedSession {
  id: string;
  label: string;
  browser: Browser;
  context: BrowserContext;
  pages: Page[];
  createdAt: number;
  lastUsedAt: number;
  taskId?: string;
  planId?: string;
  errorCount: number;
}

const sessions = new Map<string, ManagedSession>();
let sharedBrowser: Browser | null = null;

async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowser) {
    sharedBrowser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return sharedBrowser;
}

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

async function createSessionContext(browser: Browser, label: string): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
}

export async function createSession(label = "default", planId?: string): Promise<ManagedSession> {
  const limits = getResourceLimits();
  if (sessions.size >= limits.maxSessions) {
    throw new Error(`Session limit reached: ${limits.maxSessions}`);
  }

  const browser = await getSharedBrowser();
  const context = await createIsolatedContext(browser, label);
  const page = await context.newPage();

  const session: ManagedSession = {
    id: generateSessionId(),
    label,
    browser,
    context,
    pages: [page],
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    planId,
    errorCount: 0,
  };

  sessions.set(session.id, session);
  return session;
}

export function getSession(sessionId: string): ManagedSession | undefined {
  const s = sessions.get(sessionId);
  if (s) s.lastUsedAt = Date.now();
  return s;
}

export function getSessionForPlan(planId: string): ManagedSession | undefined {
  return Array.from(sessions.values()).find(s => s.planId === planId);
}

export function assignTaskToSession(sessionId: string, taskId: string): void {
  const s = sessions.get(sessionId);
  if (s) { s.taskId = taskId; s.lastUsedAt = Date.now(); }
}

export function releaseSession(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (s) { s.taskId = undefined; s.planId = undefined; }
}

export async function closeSession(sessionId: string): Promise<void> {
  const s = sessions.get(sessionId);
  if (!s) return;
  try { await s.context.close(); } catch {}
  sessions.delete(sessionId);
}

export async function closeAllSessions(): Promise<void> {
  for (const id of sessions.keys()) await closeSession(id);
  if (sharedBrowser) {
    try { await sharedBrowser.close(); } catch {}
    sharedBrowser = null;
  }
}

export function listSessions(): ManagedSession[] {
  return Array.from(sessions.values());
}

export function sessionStats(): { total: number; active: number; idle: number } {
  const now = Date.now();
  const all = listSessions();
  return {
    total: all.length,
    active: all.filter(s => s.taskId).length,
    idle: all.filter(s => !s.taskId && (now - s.lastUsedAt) > 30000).length,
  };
}

export function recordSessionError(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (s) s.errorCount++;
}

export async function getPageForSession(sessionId: string): Promise<Page> {
  const s = getSession(sessionId);
  if (!s) throw new Error(`Session ${sessionId} not found`);
  s.lastUsedAt = Date.now();

  const livePages = s.context.pages();
  s.pages = livePages;

  if (livePages.length === 0) {
    const p = await s.context.newPage();
    s.pages = [p];
    return p;
  }
  return livePages[0];
}
