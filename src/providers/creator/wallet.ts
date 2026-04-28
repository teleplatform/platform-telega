import fs from "fs/promises";
import path from "path";

const TELEGA_DIR = path.join(process.cwd(), "data", "telega");
const WALLETS_FILE = path.join(TELEGA_DIR, "wallets.jsonl");
const TRANSACTIONS_FILE = path.join(TELEGA_DIR, "transactions.jsonl");

export type TxType = "credit" | "debit" | "hold" | "release" | "refund";
export type TxStatus = "pending" | "completed" | "failed";
export type TxSource = "order" | "reward" | "purchase" | "refund" | "promotion" | "ai_action";

export interface Wallet {
  user_id: string;
  teleton_balance: number;
  bonus_points: number;
  cashback_points: number;
  locked_balance: number;
  created_at: number;
  updated_at: number;
}

export interface Transaction {
  tx_id: string;
  type: TxType;
  user_id: string;
  amount: number;
  currency: string;
  source: TxSource;
  reference_id?: string;
  status: TxStatus;
  created_at: number;
  completed_at?: number;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(TELEGA_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function appendWallet(wallet: Wallet): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(wallet) + "\n";
    await fs.appendFile(WALLETS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[wallet] write failed", e);
  }
}

export async function appendTransaction(tx: Transaction): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(tx) + "\n";
    await fs.appendFile(TRANSACTIONS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[wallet] tx write failed", e);
  }
}

export async function loadWallets(): Promise<Wallet[]> {
  const wallets: Wallet[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(WALLETS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.user_id) {
          wallets.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return wallets;
}

export async function getWallet(userId: string): Promise<Wallet | null> {
  const wallets = await loadWallets();
  return wallets.find(w => w.user_id === userId) || null;
}

export async function getOrCreateWallet(userId: string): Promise<Wallet> {
  let wallet = await getWallet(userId);
  
  if (!wallet) {
    wallet = {
      user_id: userId,
      teleton_balance: 100,
      bonus_points: 0,
      cashback_points: 0,
      locked_balance: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    await appendWallet(wallet);
    
    await createTransaction(
      userId,
      "credit",
      100,
      "reward",
      "Welcome bonus"
    );
  }
  
  return wallet;
}

export async function createTransaction(
  userId: string,
  type: TxType,
  amount: number,
  source: TxSource,
  referenceId?: string,
  status: TxStatus = "completed"
): Promise<Transaction> {
  const tx: Transaction = {
    tx_id: makeId("tx"),
    type,
    user_id: userId,
    amount,
    currency: "teleton",
    source,
    reference_id: referenceId,
    status,
    created_at: Date.now(),
    completed_at: status === "completed" ? Date.now() : undefined,
  };
  
  await appendTransaction(tx);
  return tx;
}

export async function loadTransactions(userId: string, limit = 20): Promise<Transaction[]> {
  const txs: Transaction[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(TRANSACTIONS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).slice(-limit);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.user_id === userId) {
          txs.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return txs.sort((a, b) => b.created_at - a.created_at);
}

export async function holdFunds(
  userId: string,
  amount: number,
  referenceId: string
): Promise<{ success: boolean; reason?: string }> {
  const wallet = await getOrCreateWallet(userId);
  
  const available = wallet.teleton_balance - wallet.locked_balance;
  if (amount > available) {
    return { success: false, reason: "insufficient_funds" };
  }
  
  wallet.locked_balance += amount;
  wallet.updated_at = Date.now();
  await appendWallet(wallet);
  
  await createTransaction(userId, "hold", amount, "order", referenceId);
  
  return { success: true };
}

export async function releaseFunds(
  userId: string,
  amount: number,
  referenceId: string
): Promise<boolean> {
  const wallet = await getWallet(userId);
  if (!wallet) return false;
  
  if (wallet.locked_balance < amount) return false;
  
  wallet.locked_balance -= amount;
  wallet.updated_at = Date.now();
  await appendWallet(wallet);
  
  await createTransaction(userId, "release", amount, "order", referenceId);
  
  return true;
}

export async function releaseToSeller(
  sellerId: string,
  amount: number,
  referenceId: string,
  buyerId: string
): Promise<boolean> {
  const buyerWallet = await getWallet(buyerId);
  const sellerWallet = await getOrCreateWallet(sellerId);
  
  if (!buyerWallet || buyerWallet.locked_balance < amount) {
    return false;
  }
  
  buyerWallet.locked_balance -= amount;
  buyerWallet.teleton_balance -= amount;
  buyerWallet.updated_at = Date.now();
  await appendWallet(buyerWallet);
  
  sellerWallet.teleton_balance += amount;
  sellerWallet.updated_at = Date.now();
  await appendWallet(sellerWallet);
  
  await createTransaction(buyerId, "debit", amount, "order", referenceId);
  await createTransaction(sellerId, "credit", amount, "order", referenceId);
  
  return true;
}

export async function refundToBuyer(
  buyerId: string,
  amount: number,
  referenceId: string
): Promise<boolean> {
  const buyerWallet = await getWallet(buyerId);
  if (!buyerWallet) return false;
  
  if (buyerWallet.locked_balance < amount) return false;
  
  buyerWallet.locked_balance -= amount;
  buyerWallet.teleton_balance += amount;
  buyerWallet.updated_at = Date.now();
  await appendWallet(buyerWallet);
  
  await createTransaction(buyerId, "credit", amount, "refund", referenceId);
  
  return true;
}

export async function purchaseTeleton(
  userId: string,
  amount: number,
  provider: string = "manual"
): Promise<boolean> {
  const wallet = await getOrCreateWallet(userId);
  
  wallet.teleton_balance += amount;
  wallet.updated_at = Date.now();
  await appendWallet(wallet);
  
  await createTransaction(userId, "credit", amount, "purchase", `${provider}_${Date.now()}`);
  
  return true;
}

export async function spendTeleton(
  userId: string,
  amount: number,
  source: TxSource,
  referenceId?: string
): Promise<{ success: boolean; reason?: string }> {
  const wallet = await getOrCreateWallet(userId);
  
  const available = wallet.teleton_balance - wallet.locked_balance;
  if (amount > available) {
    return { success: false, reason: "insufficient_funds" };
  }
  
  const cashback = Math.floor(amount * 0.05);
  
  wallet.teleton_balance -= amount;
  wallet.cashback_points += cashback;
  wallet.updated_at = Date.now();
  await appendWallet(wallet);
  
  await createTransaction(userId, "debit", amount, source, referenceId);
  
  if (cashback > 0) {
    await createTransaction(userId, "credit", cashback, "reward", `${referenceId}_cashback`);
  }
  
  return { success: true };
}

export function formatWallet(wallet: Wallet): string {
  const available = wallet.teleton_balance - wallet.locked_balance;
  
  const lines = [
    "💰 Wallet",
    `Balance: ${wallet.teleton_balance.toLocaleString()} TN`,
    `Available: ${available.toLocaleString()} TN`,
    `Locked: ${wallet.locked_balance.toLocaleString()} TN`,
    `Cashback: ${wallet.cashback_points.toLocaleString()} pts`,
    `Bonus: ${wallet.bonus_points.toLocaleString()} pts`,
  ];
  
  return lines.join("\n");
}

export function formatTransactionList(txs: Transaction[]): string {
  if (txs.length === 0) return "No transactions";
  
  const typeEmoji: Record<TxType, string> = {
    credit: "➕",
    debit: "➖",
    hold: "🔒",
    release: "🔓",
    refund: "↩️",
  };
  
  const lines = ["💳 Transactions:\n"];
  for (const tx of txs.slice(0, 10)) {
    const sign = tx.type === "credit" || tx.type === "release" || tx.type === "refund" ? "+" : "-";
    lines.push(`${typeEmoji[tx.type]} ${sign}${tx.amount} TN (${tx.type}) - ${tx.source}`);
    lines.push(`   ${new Date(tx.created_at).toLocaleString()}`);
  }
  
  return lines.join("\n");
}

export async function integrateWithOrder(
  orderId: string,
  buyerId: string,
  sellerId: string,
  amount: number,
  action: "hold" | "release" | "refund"
): Promise<{ success: boolean; reason?: string }> {
  switch (action) {
    case "hold":
      return holdFunds(buyerId, amount, orderId);
    
    case "release":
      const released = await releaseToSeller(sellerId, amount, orderId, buyerId);
      return { success: released, reason: released ? undefined : "release_failed" };
    
    case "refund":
      const refunded = await refundToBuyer(buyerId, amount, orderId);
      return { success: refunded, reason: refunded ? undefined : "refund_failed" };
    
    default:
      return { success: false, reason: "unknown_action" };
  }
}

export async function checkUserLimit(userId: string, required: number): Promise<{ allowed: boolean; current: number; needed: number }> {
  const wallet = await getOrCreateWallet(userId);
  const available = wallet.teleton_balance - wallet.locked_balance;
  
  return {
    allowed: available >= required,
    current: available,
    needed: required,
  };
}