import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const MARKET_DIR = path.join(DATA_DIR, "marketplace");

interface OrderLock {
  order_id: string;
  key: string;
  locked_at: number;
  released_at?: number;
}

interface PaymentGuard {
  order_id: string;
  amount: number;
  status: "pending" | "paid" | "refunded" | "failed";
  idempotency_key: string;
  created_at: number;
  paid_at?: number;
}

interface LoadState {
  active_orders: number;
  max_orders: number;
  throttle_until?: number;
}

interface AdsBudget {
  campaign_id: string;
  daily_limit: number;
  spent_today: number;
  per_campaign_limit: number;
  auto_stop: boolean;
}

interface FraudFlag {
  user_id: string;
  reason: string;
  flagged_at: number;
}

const LOCKS_FILE = path.join(MARKET_DIR, "order-locks.jsonl");
const PAYMENTS_FILE = path.join(MARKET_DIR, "payment-guards.jsonl");
const FRAUD_FILE = path.join(MARKET_DIR, "fraud-flags.jsonl");

const DEFAULT_MAX_ORDERS = 50;
const DAILY_ADS_LIMIT = 10000;
const PER_CAMPAIGN_LIMIT = 5000;

const loadState: LoadState = {
  active_orders: 0,
  max_orders: DEFAULT_MAX_ORDERS,
};

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

async function logEvent(event: string, data: object): Promise<void> {
  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "scale-events.jsonl");
  const line = JSON.stringify({ event, ...data, timestamp: Date.now() });
  await fs.appendFile(file, line + "\n");
}

export async function lockOrder(orderId: string, idempotencyKey: string): Promise<boolean> {
  await ensureDir(MARKET_DIR);
  
  const locks: OrderLock[] = [];
  try {
    const content = await fs.readFile(LOCKS_FILE, "utf-8");
    locks.push(...content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)));
  } catch {}

  const existing = locks.find((l) => l.order_id === orderId && !l.released_at);
  if (existing) {
    if (existing.key === idempotencyKey) {
      await logEvent("order_lock_reused", { order_id: orderId });
      return true;
    }
    await logEvent("order_lock_rejected", { order_id: orderId, reason: "already_locked" });
    return false;
  }

  const lock: OrderLock = {
    order_id: orderId,
    key: idempotencyKey,
    locked_at: Date.now(),
  };
  await fs.appendFile(LOCKS_FILE, JSON.stringify(lock) + "\n");
  await logEvent("order_locked", { order_id: orderId });
  
  loadState.active_orders++;
  return true;
}

export async function unlockOrder(orderId: string): Promise<void> {
  await ensureDir(MARKET_DIR);
  const locks: OrderLock[] = [];
  
  try {
    const content = await fs.readFile(LOCKS_FILE, "utf-8");
    locks.push(...content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)));
  } catch {}

  const lock = locks.find((l) => l.order_id === orderId);
  if (lock) {
    lock.released_at = Date.now();
    await fs.writeFile(LOCKS_FILE, locks.map((l) => JSON.stringify(l)).join("\n") + "\n");
    loadState.active_orders = Math.max(0, loadState.active_orders - 1);
    await logEvent("order_unlocked", { order_id: orderId });
  }
}

export async function safePayment(
  orderId: string,
  idempotencyKey: string,
  amount: number
): Promise<{ success: boolean; error?: string; payment_id?: string }> {
  if (loadState.active_orders >= loadState.max_orders) {
    await logEvent("payment_rejected", { reason: "load_limit" });
    return { success: false, error: "System load limit reached. Try later." };
  }

  await ensureDir(MARKET_DIR);
  const guards: PaymentGuard[] = [];
  try {
    const content = await fs.readFile(PAYMENTS_FILE, "utf-8");
    guards.push(...content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)));
  } catch {}

  const existing = guards.find((g) => g.order_id === orderId && g.idempotency_key === idempotencyKey);
  if (existing) {
    if (existing.status === "paid") {
      await logEvent("payment_rejected", { reason: "already_paid" });
      return { success: false, error: "Already paid" };
    }
  }

  const guard: PaymentGuard = {
    order_id: orderId,
    amount,
    status: "pending",
    idempotency_key: idempotencyKey,
    created_at: Date.now(),
  };
  await fs.appendFile(PAYMENTS_FILE, JSON.stringify(guard) + "\n");

  guard.status = "paid";
  guard.paid_at = Date.now();
  await fs.appendFile(PAYMENTS_FILE, JSON.stringify(guard) + "\n");

  await logEvent("payment_completed", { order_id: orderId, amount });
  return { success: true, payment_id: `pay_${Date.now()}` };
}

export async function refundOrder(orderId: string): Promise<boolean> {
  await ensureDir(MARKET_DIR);
  const guards: PaymentGuard[] = [];
  
  try {
    const content = await fs.readFile(PAYMENTS_FILE, "utf-8");
    guards.push(...content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)));
  } catch {}

  const guard = guards.find((g) => g.order_id === orderId);
  if (guard && guard.status === "paid") {
    guard.status = "refunded";
    await fs.appendFile(PAYMENTS_FILE, JSON.stringify(guard) + "\n");
    await logEvent("order_refunded", { order_id: orderId });
    await unlockOrder(orderId);
    return true;
  }
  return false;
}

export function getSystemLoad(): LoadState {
  return { ...loadState };
}

export function setThrottle(minutes: number): void {
  loadState.throttle_until = Date.now() + minutes * 60 * 1000;
  logEvent("throttle_enabled", { minutes });
}

export async function checkFraudRisk(userId: string): Promise<{ flagged: boolean; reason?: string }> {
  await ensureDir(MARKET_DIR);
  
  try {
    const content = await fs.readFile(FRAUD_FILE, "utf-8");
    const flags = content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const flag = flags.find((f: FraudFlag) => f.user_id === userId);
    if (flag) {
      return { flagged: true, reason: flag.reason };
    }
  } catch {}
  
  return { flagged: false };
}

export async function flagFraud(userId: string, reason: string): Promise<void> {
  const flag: FraudFlag = {
    user_id: userId,
    reason,
    flagged_at: Date.now(),
  };
  await ensureDir(MARKET_DIR);
  await fs.appendFile(FRAUD_FILE, JSON.stringify(flag) + "\n");
  await logEvent("fraud_flagged", { user_id: userId, reason });
}

export async function checkDailyBudget(campaignId: string, proposedSpend: number): Promise<{
  allowed: boolean;
  current_spend: number;
  remaining: number;
}> {
  const current = Math.random() * DAILY_ADS_LIMIT;
  const remaining = DAILY_ADS_LIMIT - current;
  
  if (current + proposedSpend > DAILY_ADS_LIMIT) {
    await logEvent("budget_exceeded", { campaign_id: campaignId });
    return { allowed: false, current_spend: Math.round(current), remaining: 0 };
  }
  
  return { allowed: true, current_spend: Math.round(current), remaining: Math.round(remaining) };
}

export async function getScaleReport(): Promise<{
  active_orders: number;
  max_orders: number;
  throttled: boolean;
  total_payments: number;
  total_refunds: number;
}> {
  await ensureDir(MARKET_DIR);
  
  let total_payments = 0, total_refunds = 0;
  try {
    const paymentsContent = await fs.readFile(PAYMENTS_FILE, "utf-8");
    const payments = paymentsContent.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    total_payments = payments.filter((p: PaymentGuard) => p.status === "paid").length;
    total_refunds = payments.filter((p: PaymentGuard) => p.status === "refunded").length;
  } catch {}

  const throttled = loadState.throttle_until ? Date.now() < loadState.throttle_until : false;

  return {
    active_orders: loadState.active_orders,
    max_orders: loadState.max_orders,
    throttled,
    total_payments,
    total_refunds,
  };
}