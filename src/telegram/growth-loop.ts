import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const MARKET_DIR = path.join(DATA_DIR, "marketplace");

interface Order {
  id: string;
  product_id: string;
  user_id: string;
  amount: number;
  status: "pending" | "completed" | "cancelled";
  repeat_count: number;
  created_at: number;
  completed_at?: number;
}

interface Customer {
  user_id: string;
  order_count: number;
  total_spent: number;
  last_order_at?: number;
  repeat_count: number;
  rating?: number;
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

export async function createRepeatOrder(
  productId: string,
  userId: string,
  discount: number = 0
): Promise<Order> {
  const products = await getProducts();
  const product = products.find((p) => p.id === productId);
  const amount = product ? product.price : 5000;
  const discountedAmount = discount > 0 ? Math.round(amount * (1 - discount / 100)) : amount;

  const order: Order = {
    id: `order_${Date.now()}`,
    product_id: productId,
    user_id: userId,
    amount: discountedAmount,
    status: "pending",
    repeat_count: 1,
    created_at: Date.now(),
  };

  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "orders-active.jsonl");
  await fs.appendFile(file, JSON.stringify(order) + "\n");

  await logEvent("repeat_order_created", { order_id: order.id, user_id: userId, discount });
  console.log("[growth] Repeat order:", order.id);

  return order;
}

export async function completeOrder(orderId: string, rating?: number): Promise<boolean> {
  try {
    const file = path.join(MARKET_DIR, "orders-active.jsonl");
    const content = await fs.readFile(file, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const orders = lines.map((l) => JSON.parse(l));
    const order = orders.find((o: Order) => o.id === orderId);

    if (!order) return false;

    order.status = "completed";
    order.completed_at = Date.now();

    await ensureDir(MARKET_DIR);
    const completedFile = path.join(MARKET_DIR, "orders-completed.jsonl");
    await fs.appendFile(completedFile, JSON.stringify(order) + "\n");

    await updateCustomer(order.user_id, order.amount, rating);
    await logEvent("order_completed", { order_id: orderId, rating });

    console.log("[growth] Order completed:", orderId);
    return true;
  } catch (e) {
    console.error("[growth] complete order error", e);
    return false;
  }
}

async function updateCustomer(userId: string, amount: number, rating?: number): Promise<void> {
  const file = path.join(MARKET_DIR, "customers.jsonl");
  let customers: Customer[] = [];

  try {
    const content = await fs.readFile(file, "utf-8");
    customers = content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {}

  const customer = customers.find((c) => c.user_id === userId);
  if (customer) {
    customer.order_count++;
    customer.total_spent += amount;
    customer.last_order_at = Date.now();
    if (rating) customer.rating = rating;
  } else {
    customers.push({
      user_id: userId,
      order_count: 1,
      total_spent: amount,
      last_order_at: Date.now(),
      repeat_count: 0,
      rating,
    });
  }

  await fs.writeFile(file, customers.map((c) => JSON.stringify(c)).join("\n") + "\n");
}

export async function getCustomerStats(userId?: string): Promise<Customer[]> {
  const file = path.join(MARKET_DIR, "customers.jsonl");
  try {
    const content = await fs.readFile(file, "utf-8");
    const customers = content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    if (userId) {
      return customers.filter((c: Customer) => c.user_id === userId);
    }
    return customers;
  } catch {
    return [];
  }
}

export async function submitReview(
  orderId: string,
  rating: number,
  comment?: string
): Promise<boolean> {
  if (rating < 1 || rating > 5) return false;

  const review = {
    id: `review_${Date.now()}`,
    order_id: orderId,
    rating,
    comment: comment || "",
    is_public: rating >= 4,
    created_at: Date.now(),
  };

  await ensureDir(MARKET_DIR);
  const reviewsFile = path.join(MARKET_DIR, "reviews.jsonl");
  await fs.appendFile(reviewsFile, JSON.stringify(review) + "\n");

  await logEvent("review_submitted", { order_id: orderId, rating, is_public: review.is_public });

  console.log("[growth] Review:", review.id, "public:", review.is_public);
  return true;
}

export async function generateReferralLink(userId: string): Promise<string> {
  const refCode = `ref_${userId}_${Date.now().toString(36)}`;
  const link = {
    code: refCode,
    user_id: userId,
    reward_percent: 5,
    created_at: Date.now(),
    used_by: [],
  };

  await ensureDir(MARKET_DIR);
  const refFile = path.join(MARKET_DIR, "referrals.jsonl");
  await fs.appendFile(refFile, JSON.stringify(link) + "\n");

  await logEvent("referral_created", { code: refCode });
  console.log("[growth] Referral:", refCode);

  return refCode;
}

export async function getPublicReviews(): Promise<any[]> {
  const file = path.join(MARKET_DIR, "reviews.jsonl");
  try {
    const content = await fs.readFile(file, "utf-8");
    const reviews = content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    return reviews.filter((r: any) => r.is_PUBLIC).slice(0, 10);
  } catch {
    return [];
  }
}

function getProducts(): Promise<any[]> {
  return new Promise(async (resolve) => {
    const file = path.join(MARKET_DIR, "offers.jsonl");
    try {
      const content = await fs.readFile(file, "utf-8");
      resolve(content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)));
    } catch {
      resolve([]);
    }
  });
}

async function logEvent(event: string, data: object): Promise<void> {
  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "growth-events.jsonl");
  const line = JSON.stringify({ event, ...data, timestamp: Date.now() });
  await fs.appendFile(file, line + "\n");
}