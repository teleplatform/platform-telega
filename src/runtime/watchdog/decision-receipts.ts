import * as fs from "node:fs";
import * as path from "node:path";
import type { DecisionReceipt } from "./decision-engine.types.js";

const RECEIPT_FILE = path.resolve(process.cwd(), "telegram-bot.decisions.log");

export function writeReceipt(receipt: DecisionReceipt): void {
  const line = JSON.stringify(receipt) + "\n";
  try {
    fs.appendFileSync(RECEIPT_FILE, line, "utf-8");
  } catch {
    // silently fail - receipts are advisory
  }
}

export function getRecentReceipts(count = 20): DecisionReceipt[] {
  try {
    const content = fs.readFileSync(RECEIPT_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    return lines.slice(-count).map(line => JSON.parse(line) as DecisionReceipt);
  } catch {
    return [];
  }
}

export function getReceiptsSince(timestamp: number): DecisionReceipt[] {
  try {
    const content = fs.readFileSync(RECEIPT_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    return lines
      .map(line => JSON.parse(line) as DecisionReceipt)
      .filter(r => r.timestamp >= timestamp);
  } catch {
    return [];
  }
}

export function getRecoveryCountInWindow(windowMs: number): number {
  try {
    const now = Date.now();
    const content = fs.readFileSync(RECEIPT_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    return lines.filter(line => {
      const r = JSON.parse(line) as DecisionReceipt;
      return (
        r.selectedAction !== "NO_OP" &&
        now - r.timestamp < windowMs
      );
    }).length;
  } catch {
    return 0;
  }
}

export function getLastReceipt(): DecisionReceipt | null {
  const receipts = getRecentReceipts(1);
  return receipts[0] || null;
}

export function clearReceipts(): void {
  try {
    fs.unlinkSync(RECEIPT_FILE);
  } catch {
    // ignore if file doesn't exist
  }
}
