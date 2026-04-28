import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

export type WebProviderAuditAction =
  | 'reset'
  | 'disable'
  | 'enable'
  | 'rehab_set'
  | 'cooldown_applied'
  | 'cooldown_cleared'
  | 'fallback_selected'
  | 'fallback_skipped'
  | 'state_hydrated'
  | 'bootstrap';

export type WebProviderAuditSource = 'cli' | 'runtime' | 'auto';

export interface WebProviderAuditEvent {
  eventId: string;
  ts: number;
  action: WebProviderAuditAction;
  provider: 'openai_web' | 'qwen_web' | 'deepseek_web';
  source: WebProviderAuditSource;
  operator?: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  traceSummary?: string[];
}

const AUDIT_DIR = path.join(os.homedir(), '.telegpt', 'state');
const AUDIT_FILE = path.join(AUDIT_DIR, 'web-provider-audit-log.jsonl');

function ensureAuditDir() {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
}

export function recordAuditEvent(event: Omit<WebProviderAuditEvent, 'eventId'>): WebProviderAuditEvent {
  ensureAuditDir();

  const fullEvent: WebProviderAuditEvent = {
    ...event,
    eventId: randomUUID(),
    ts: Date.now(),
  };

  const line = JSON.stringify(fullEvent) + '\n';
  fs.appendFileSync(AUDIT_FILE, line, 'utf8');

  return fullEvent;
}

export function getAuditLog(limit = 100): WebProviderAuditEvent[] {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return [];
    
    const content = fs.readFileSync(AUDIT_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    return lines
      .slice(-limit)
      .map(line => JSON.parse(line) as WebProviderAuditEvent);
  } catch {
    return [];
  }
}

export function getAuditLogForProvider(
  provider: 'openai_web' | 'qwen_web' | 'deepseek_web',
  limit = 50
): WebProviderAuditEvent[] {
  return getAuditLog(limit).filter(e => e.provider === provider);
}

export function clearAuditLog(): void {
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      fs.unlinkSync(AUDIT_FILE);
    }
  } catch {
    // ignore
  }
}