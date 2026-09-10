/**
 * Dispatcher SHADOW divergence report — from a live audit trail.
 *
 * Reads `routing.dispatcher.*` events from the audit store (default
 * .data/runtime/audit.jsonl under cwd) or a captured NDJSON file and prints
 * the aggregated divergence report. Use during the real observation window:
 *
 *   node --import tsx scripts/dispatcher/shadow-divergence-report.ts \
 *     --source .data/runtime/audit.jsonl --out shadow-report.md
 */

import { promises as fs } from "node:fs";
import type { AuditEvent } from "../../src/runtime/audit/audit-types.js";
import {
  buildDivergenceReport,
  formatAsciiSummary,
  formatMarkdownReport,
} from "./shadow-report-lib.js";

function parseArgs(argv: string[]) {
  const get = (name: string, fallback?: string) => {
    const idx = argv.indexOf(name);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : (fallback ?? "");
  };
  return {
    source: get("--source", ".data/runtime/audit.jsonl"),
    outPath: get("--out") || undefined,
    since: get("--since") || undefined,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let events: AuditEvent[];

  if (/\.(jsonl|ndjson)$/.test(args.source)) {
    const raw = await fs.readFile(args.source, "utf8");
    events = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditEvent);
  } else {
    const { queryAuditTrail } = await import("../../src/runtime/audit/audit-store.js");
    events = queryAuditTrail({
      kinds: ["routing.dispatcher.shadow_decision", "routing.dispatcher.error"],
      since: args.since,
      order: "asc",
    });
  }

  events = events.filter(
    (e) => e.kind === "routing.dispatcher.shadow_decision" || e.kind === "routing.dispatcher.error",
  );

  if (args.since) {
    events = events.filter((e) => e.timestamp >= args.since!);
  }

  const report = buildDivergenceReport(events, { sourceLabel: args.source });
  console.log(formatAsciiSummary(report));

  if (args.outPath) {
    await fs.writeFile(args.outPath, formatMarkdownReport(report), "utf8");
    console.log(`\nmarkdown: ${args.outPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});