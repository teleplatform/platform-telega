import fs from "fs/promises";
import path from "path";

const TELEGA_DIR = path.join(process.cwd(), "data", "telega");
const PAYOUTS_FILE = path.join(TELEGA_DIR, "payouts.jsonl");

export type PayoutMethod = "click" | "payme" | "stripe" | "yoomoney" | "bank";
export type PayoutStatus = "pending" | "approved" | "processing" | "completed" | "rejected";

export interface Payout {
  payout_id: string;
  user_id: string;
  amount_teleton: number;
  amount_fiat: number;
  currency: string;
  fee_teleton: number;
  method: PayoutMethod;
  details: string;
  status: PayoutStatus;
  reason?: string;
  created_at: number;
  processed_at?: number;
  completed_at?: number;
}

const FEE_RATE = 0.05;

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(TELEGA_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function appendPayout(payout: Payout): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(payout) + "\n";
    await fs.appendFile(PAYOUTS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[payout] write failed", e);
  }
}

export async function loadPayouts(userId?: string, status?: PayoutStatus): Promise<Payout[]> {
  const payouts: Payout[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(PAYOUTS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.payout_id) {
          if (userId && parsed.user_id !== userId) continue;
          if (status && parsed.status !== status) continue;
          payouts.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return payouts.sort((a, b) => b.created_at - a.created_at);
}

export async function getPayout(payoutId: string): Promise<Payout | null> {
  const payouts = await loadPayouts(undefined, undefined);
  return payouts.find(p => p.payout_id === payoutId) || null;
}

export async function createPayoutRequest(
  userId: string,
  amountTeleton: number,
  method: PayoutMethod,
  details: string,
  userCurrency: string = "UZS"
): Promise<{ success: boolean; payout?: Payout; reason?: string }> {
  if (amountTeleton < 100) {
    return { success: false, reason: "minimum_100_tn" };
  }

  const { getOrCreateWallet, getWallet } = await import("./wallet.js");
  const wallet = await getOrCreateWallet(userId);
  
  const available = wallet.teleton_balance - wallet.locked_balance;
  if (amountTeleton > available) {
    return { success: false, reason: "insufficient_funds" };
  }

  const fee = Math.ceil(amountTeleton * FEE_RATE);
  const netAmount = amountTeleton - fee;

  const { convertTeletonToLocal } = await import("./global-expansion.js");
  const amountFiat = await convertTeletonToLocal(netAmount, userCurrency as any);

  const payout: Payout = {
    payout_id: makeId("pout"),
    user_id: userId,
    amount_teleton: amountTeleton,
    amount_fiat: amountFiat,
    currency: userCurrency,
    fee_teleton: fee,
    method,
    details,
    status: "pending",
    created_at: Date.now(),
  };

  wallet.locked_balance += amountTeleton;
  await getWallet; // Just to ensure wallet functions are loaded
  const { appendWallet } = await import("./wallet.js");
  await appendWallet(wallet);

  await appendPayout(payout);

  return { success: true, payout };
}

export async function approvePayout(
  payoutId: string,
  ownerId: string
): Promise<{ success: boolean; reason?: string }> {
  const payout = await getPayout(payoutId);
  if (!payout) return { success: false, reason: "not_found" };
  if (payout.status !== "pending") return { success: false, reason: "not_pending" };

  payout.status = "approved";
  payout.processed_at = Date.now();
  await appendPayout(payout);

  return { success: true };
}

export async function processPayout(
  payoutId: string
): Promise<{ success: boolean; reason?: string }> {
  const payout = await getPayout(payoutId);
  if (!payout) return { success: false, reason: "not_found" };
  if (payout.status !== "approved") return { success: false, reason: "not_approved" };

  payout.status = "processing";
  await appendPayout(payout);

  const { getOrCreateWallet, releaseToSeller } = await import("./wallet.js");
  const wallet = await getOrCreateWallet(payout.user_id);

  const netAmount = payout.amount_teleton - payout.fee_teleton;
  
  if (wallet.locked_balance >= payout.amount_teleton) {
    wallet.locked_balance -= payout.amount_teleton;
    wallet.teleton_balance -= payout.amount_teleton;
    wallet.updated_at = Date.now();
    const { appendWallet } = await import("./wallet.js");
    await appendWallet(wallet);
  } else {
    payout.status = "approved";
    return { success: false, reason: "funds_not_locked" };
  }

  payout.status = "completed";
  payout.completed_at = Date.now();
  await appendPayout(payout);

  return { success: true };
}

export async function rejectPayout(
  payoutId: string,
  ownerId: string,
  reason: string
): Promise<{ success: boolean; reason?: string }> {
  const payout = await getPayout(payoutId);
  if (!payout) return { success: false, reason: "not_found" };
  if (payout.status !== "pending") return { success: false, reason: "not_pending" };

  payout.status = "rejected";
  payout.reason = reason;
  payout.processed_at = Date.now();
  await appendPayout(payout);

  const { getOrCreateWallet } = await import("./wallet.js");
  const wallet = await getOrCreateWallet(payout.user_id);
  
  if (wallet.locked_balance >= payout.amount_teleton) {
    wallet.locked_balance -= payout.amount_teleton;
    wallet.updated_at = Date.now();
    const { appendWallet } = await import("./wallet.js");
    await appendWallet(wallet);
  }

  return { success: true };
}

export function formatPayout(payout: Payout): string {
  const statusEmoji: Record<PayoutStatus, string> = {
    pending: "⏳",
    approved: "✅",
    processing: "🔄",
    completed: "🎉",
    rejected: "❌",
  };

  const lines = [
    `${statusEmoji[payout.status]} Payout: ${payout.payout_id}`,
    `Amount: ${payout.amount_teleton} TN (${payout.amount_fiat.toLocaleString()} ${payout.currency})`,
    `Fee: ${payout.fee_teleton} TN (${(FEE_RATE * 100)}%)`,
    `Method: ${payout.method}`,
    `Details: ${payout.details}`,
    `Status: ${payout.status}`,
    `Created: ${new Date(payout.created_at).toLocaleString()}`,
  ];

  if (payout.reason) lines.push(`Reason: ${payout.reason}`);

  return lines.join("\n");
}

export function formatPayoutList(payouts: Payout[]): string {
  if (payouts.length === 0) return "No payouts found";

  const statusEmoji: Record<PayoutStatus, string> = {
    pending: "⏳",
    approved: "✅",
    processing: "🔄",
    completed: "🎉",
    rejected: "❌",
  };

  const lines = [`💳 Payouts (${payouts.length}):\n`];
  for (const p of payouts.slice(0, 10)) {
    lines.push(`${statusEmoji[p.status]} ${p.payout_id}: ${p.amount_teleton} TN → ${p.amount_fiat.toLocaleString()} ${p.currency}`);
    lines.push(`   Method: ${p.method} | Status: ${p.status}`);
  }
  return lines.join("\n");
}

export async function getPayoutStats(userId: string): Promise<{
  total_requested: number;
  total_completed: number;
  total_fees: number;
  pending_count: number;
}> {
  const payouts = await loadPayouts(userId);
  const completed = payouts.filter(p => p.status === "completed");
  
  return {
    total_requested: payouts.reduce((s, p) => s + p.amount_teleton, 0),
    total_completed: completed.reduce((s, p) => s + p.amount_teleton, 0),
    total_fees: payouts.reduce((s, p) => s + p.fee_teleton, 0),
    pending_count: payouts.filter(p => p.status === "pending").length,
  };
}
