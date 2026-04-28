import * as fs from "node:fs";
import * as path from "node:path";
import type { DeliveryEvidenceRecord } from "./delivery-evidence.types.js";

const FILE = path.resolve(process.cwd(), "delivery-evidence.log");

export function appendEvidence(record: DeliveryEvidenceRecord) {
  const line = JSON.stringify(record) + "\n";
  fs.appendFileSync(FILE, line, "utf-8");
}

export function getRecentEvidence(count = 20): DeliveryEvidenceRecord[] {
  try {
    const content = fs.readFileSync(FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    return lines.slice(-count).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

export function getRecentErrors(count = 20): DeliveryEvidenceRecord[] {
  return getRecentEvidence(count).filter(r => r.status === "error");
}

export function getMetrics() {
  const records = getRecentEvidence(1000);
  const success = records.filter(r => r.status === "success").length;
  const blocked = records.filter(r => r.status === "blocked").length;
  const error = records.filter(r => r.status === "error").length;
  const fallback = records.filter(r => r.status === "fallback").length;
  return { success, blocked, error, fallback, total: records.length };
}