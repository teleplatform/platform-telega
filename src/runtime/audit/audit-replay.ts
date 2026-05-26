import fs from 'node:fs';
import path from 'node:path';
import type { AuditEvent, AuditEventKind, AuditFilter, ReplayOptions, ReplayResult } from './audit-types.js';
import { queryAuditTrail, formatAuditEvent } from './audit-store.js';

export function replayAuditTrail(options: ReplayOptions): ReplayResult {
  const startTime = Date.now();
  const events = queryAuditTrail(options.filter);

  const result: ReplayResult = {
    total: events.length,
    replayed: 0,
    durationMs: 0,
    kindsEncountered: [],
  };
  const kindSet = new Set<AuditEventKind>();

  if (options.onKind) {
    const grouped = new Map<AuditEventKind, AuditEvent[]>();
    for (const event of events) {
      kindSet.add(event.kind);
      if (!grouped.has(event.kind)) grouped.set(event.kind, []);
      grouped.get(event.kind)!.push(event);
    }
    for (const [kind, kindEvents] of grouped) {
      if (options.signal?.aborted) break;
      options.onKind(kind, kindEvents);
    }
    result.kindsEncountered = [...kindSet];
    result.replayed = events.length;
  }

  if (options.onEvent) {
    for (let i = 0; i < events.length; i++) {
      if (options.signal?.aborted) break;
      kindSet.add(events[i].kind);
      options.onEvent(events[i], i);
      result.replayed++;
    }
    result.kindsEncountered = [...kindSet];
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

export async function replayAuditTrailSequential(options: ReplayOptions & { delayMs?: number }): Promise<ReplayResult> {
  const startTime = Date.now();
  const events = queryAuditTrail(options.filter);

  const result: ReplayResult = {
    total: events.length,
    replayed: 0,
    durationMs: 0,
    kindsEncountered: [],
  };
  const kindSet = new Set<AuditEventKind>();

  for (let i = 0; i < events.length; i++) {
    if (options.signal?.aborted) break;
    const event = events[i];
    kindSet.add(event.kind);

    if (options.onEvent) {
      await options.onEvent(event, i);
    }
    if (options.onKind) {
      const sameKind = events.filter(e => e.kind === event.kind);
      await options.onKind(event.kind, sameKind);
    }

    result.replayed++;

    if (options.delayMs && i < events.length - 1) {
      await new Promise(resolve => setTimeout(resolve, options.delayMs));
    }
  }

  result.kindsEncountered = [...kindSet];
  result.durationMs = Date.now() - startTime;
  return result;
}

export function exportAuditTrailJson(filter?: AuditFilter, indent = 2): string {
  const events = queryAuditTrail(filter);
  return JSON.stringify(events, null, indent);
}

export function exportAuditTrailCsv(filter?: AuditFilter, includePayload = false): string {
  const events = queryAuditTrail(filter);
  const headers = ['id', 'kind', 'severity', 'timestamp', 'traceId', 'source', 'actor', 'summary'];
  if (includePayload) headers.push('payload');

  const rows: string[] = [headers.join(',')];
  for (const e of events) {
    const row = [
      escapeCsv(e.id),
      escapeCsv(e.kind),
      escapeCsv(e.severity),
      escapeCsv(e.timestamp),
      escapeCsv(e.traceId),
      escapeCsv(e.source),
      escapeCsv(e.actor),
      escapeCsv(e.summary),
    ];
    if (includePayload) {
      row.push(escapeCsv(JSON.stringify(e.payload || {})));
    }
    rows.push(row.join(','));
  }
  return rows.join('\n');
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function saveAuditExportJson(filePath: string, filter?: AuditFilter): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const json = exportAuditTrailJson(filter);
    fs.writeFileSync(filePath, json, 'utf8');
    return true;
  } catch {
    return false;
  }
}

export function saveAuditExportCsv(filePath: string, filter?: AuditFilter, includePayload = false): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const csv = exportAuditTrailCsv(filter, includePayload);
    fs.writeFileSync(filePath, csv, 'utf8');
    return true;
  } catch {
    return false;
  }
}

export function formatAuditTrailSummary(filter?: AuditFilter): string {
  const events = queryAuditTrail(filter);
  if (events.length === 0) return 'No audit events found.';

  const lines: string[] = [];
  lines.push(`Audit Trail Summary (${events.length} events)`);
  lines.push('─'.repeat(50));

  for (const event of events.slice(0, 50)) {
    lines.push(formatAuditEvent(event));
    lines.push('');
  }

  if (events.length > 50) {
    lines.push(`... and ${events.length - 50} more events`);
  }

  return lines.join('\n');
}
