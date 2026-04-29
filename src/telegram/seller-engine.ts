import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const MARKET_DIR = path.join(DATA_DIR, "marketplace");

interface SellerProfile {
  id: string;
  name: string;
  description: string;
  category: string;
  rating: number;
  total_orders: number;
  total_revenue: number;
  products_count: number;
  status: "active" | "suspended" | "banned";
  tier: "free" | "pro";
  created_at: number;
  updated_at: number;
}

interface SellerProduct {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number;
  status: "active" | "hidden" | "sold";
}

const PRODUCTS_PER_TIER = {
  free: 3,
  pro: Infinity,
};

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

async function logEvent(event: string, data: object): Promise<void> {
  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "seller-events.jsonl");
  const line = JSON.stringify({ event, ...data, timestamp: Date.now() });
  await fs.appendFile(file, line + "\n");
}

export async function createSellerProfile(
  name: string,
  description: string,
  category: string,
  userId: string
): Promise<SellerProfile> {
  const id = `seller_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
  const profile: SellerProfile = {
    id,
    name,
    description,
    category,
    rating: 0,
    total_orders: 0,
    total_revenue: 0,
    products_count: 0,
    status: "active",
    tier: "free",
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "sellers.jsonl");
  await fs.appendFile(file, JSON.stringify(profile) + "\n");
  
  await logEvent("seller_created", { seller_id: id, name, user_id: userId });
  console.log("[seller] Profile created:", id);

  return profile;
}

export async function getSellerProfile(sellerId: string): Promise<SellerProfile | null> {
  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "sellers.jsonl");
  
  try {
    const content = await fs.readFile(file, "utf-8");
    const sellers = content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    return sellers.find((s: SellerProfile) => s.id === sellerId) || null;
  } catch {
    return null;
  }
}

export async function getSellerByUser(userId: string): Promise<SellerProfile | null> {
  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "sellers.jsonl");
  
  try {
    const content = await fs.readFile(file, "utf-8");
    const sellers = content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    return sellers.find((s: SellerProfile) => s.id.includes(userId)) || null;
  } catch {
    return null;
  }
}

export async function updateSellerStats(sellerId: string, orderDelta: number = 0, revenueDelta: number = 0): Promise<void> {
  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "sellers.jsonl");
  
  let sellers: SellerProfile[] = [];
  try {
    const content = await fs.readFile(file, "utf-8");
    sellers = content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {}
  
  const seller = sellers.find((s) => s.id === sellerId);
  if (seller) {
    seller.total_orders += orderDelta;
    seller.total_revenue += revenueDelta;
    seller.updated_at = Date.now();
    await fs.writeFile(file, sellers.map((s) => JSON.stringify(s)).join("\n") + "\n");
  }
}

export async function canAddProduct(sellerId: string): Promise<{ allowed: boolean; reason?: string }> {
  const profile = await getSellerProfile(sellerId);
  if (!profile) {
    return { allowed: false, reason: "Seller not found" };
  }

  if (profile.tier === "pro") {
    return { allowed: true };
  }

  const currentCount = await getSellerProductCount(sellerId);
  const limit = PRODUCTS_PER_TIER.free;

  if (currentCount >= limit) {
    return { allowed: false, reason: `Free tier limit: ${limit} products. Upgrade to pro.` };
  }

  return { allowed: true };
}

export async function getSellerProductCount(sellerId: string): Promise<number> {
  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "products.jsonl");
  
  try {
    const content = await fs.readFile(file, "utf-8");
    const products = content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    return products.filter((p: SellerProduct) => p.seller_id === sellerId && p.status === "active").length;
  } catch {
    return 0;
  }
}

export async function createSellerProduct(
  sellerId: string,
  title: string,
  description: string,
  price: number
): Promise<SellerProduct | null> {
  const canAdd = await canAddProduct(sellerId);
  if (!canAdd.allowed) {
    return null;
  }

  const product: SellerProduct = {
    id: `prod_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    seller_id: sellerId,
    title,
    description,
    price,
    status: "active",
  };

  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "products.jsonl");
  await fs.appendFile(file, JSON.stringify(product) + "\n");

  await updateSellerStats(sellerId, 0, 0);
  await logEvent("seller_product_created", { product_id: product.id, seller_id: sellerId });
  console.log("[seller] Product created:", product.id);

  return product;
}

export async function getSellerProducts(sellerId: string): Promise<SellerProduct[]> {
  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "products.jsonl");
  
  try {
    const content = await fs.readFile(file, "utf-8");
    const products = content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    return products.filter((p: SellerProduct) => p.seller_id === sellerId);
  } catch {
    return [];
  }
}

export async function getSellerDashboard(sellerId: string): Promise<{
  profile: SellerProfile | null;
  products: number;
  orders: number;
  revenue: number;
} | null> {
  const profile = await getSellerProfile(sellerId);
  if (!profile) return null;

  const products = await getSellerProductCount(sellerId);
  
  return {
    profile,
    products,
    orders: profile.total_orders,
    revenue: profile.total_revenue,
  };
}

export async function getAllSellers(): Promise<SellerProfile[]> {
  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "sellers.jsonl");
  
  try {
    const content = await fs.readFile(file, "utf-8");
    return content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

export async function upgradeSellerToPro(sellerId: string): Promise<boolean> {
  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "sellers.jsonl");
  
  let sellers: SellerProfile[] = [];
  try {
    const content = await fs.readFile(file, "utf-8");
    sellers = content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {}
  
  const seller = sellers.find((s) => s.id === sellerId);
  if (seller) {
    seller.tier = "pro";
    seller.updated_at = Date.now();
    await fs.writeFile(file, sellers.map((s) => JSON.stringify(s)).join("\n") + "\n");
    await logEvent("seller_upgraded", { seller_id: sellerId });
    return true;
  }
  return false;
}