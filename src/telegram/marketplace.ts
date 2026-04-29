import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const MARKET_DIR = path.join(DATA_DIR, "marketplace");

interface ProductCard {
  id: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  price_suggestion: number;
  status: "draft" | "approved" | "published" | "rejected";
  created_at: number;
  updated_at: number;
}

interface MarketplaceStats {
  total_products: number;
  published: number;
  views: number;
  orders: number;
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

async function loadProducts(): Promise<ProductCard[]> {
  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "products.jsonl");
  try {
    const content = await fs.readFile(file, "utf-8");
    return content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

async function saveProduct(product: ProductCard): Promise<void> {
  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "products.jsonl");
  await fs.appendFile(file, JSON.stringify(product) + "\n");
}

export async function generateProductCard(
  productName: string,
  userId: string
): Promise<ProductCard> {
  const id = `prod_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
  const tags = productName.toLowerCase().split(" ").slice(0, 5);
  const categories = ["digital", "service", "physical", "subscription"];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const priceSuggestion = Math.floor(Math.random() * 9000) + 1000;

  const product: ProductCard = {
    id,
    title: productName,
    description: `High-quality ${productName} for your needs. Premium quality guaranteed.`,
    tags,
    category,
    price_suggestion: priceSuggestion,
    status: "draft",
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  await saveProduct(product);
  await logEvent("product_card_generated", { product_id: id, user_id: userId });

  return product;
}

export async function approveProduct(productId: string): Promise<boolean> {
  const products = await loadProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) return false;

  product.status = "approved";
  product.updated_at = Date.now();

  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "products-approved.jsonl");
  await fs.appendFile(file, JSON.stringify(product) + "\n");

  await logEvent("product_approved", { product_id: productId });
  return true;
}

export async function publishProduct(productId: string): Promise<boolean> {
  const products = await loadProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) return false;

  product.status = "published";
  product.updated_at = Date.now();

  const file = path.join(MARKET_DIR, "products-published.jsonl");
  await fs.appendFile(file, JSON.stringify(product) + "\n");

  await logEvent("product_published", { product_id: productId });
  return true;
}

export async function getMarketplaceStats(): Promise<MarketplaceStats> {
  const products = await loadProducts();
  const publishedFile = path.join(MARKET_DIR, "products-published.jsonl");
  const publishedContent = await fs.readFile(publishedFile, "utf-8").catch(() => "");
  const published = publishedContent.trim().split("\n").filter(Boolean).length;

  return {
    total_products: products.length,
    published,
    views: 0,
    orders: 0,
  };
}

async function logEvent(event: string, data: object): Promise<void> {
  await ensureDir(MARKET_DIR);
  const file = path.join(MARKET_DIR, "audit.jsonl");
  const line = JSON.stringify({ event, ...data, timestamp: Date.now() });
  await fs.appendFile(file, line + "\n");
}

export async function getMarketplaceProducts(): Promise<ProductCard[]> {
  const products = await loadProducts();
  return products.filter((p) => p.status === "published" || p.status === "approved");
}

export async function createMarketplaceListing(
  title: string,
  description: string,
  price: number,
  userId: string
): Promise<ProductCard> {
  const id = `prod_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
  const product: ProductCard = {
    id,
    title,
    description,
    tags: [],
    category: "digital",
    price_suggestion: price,
    status: "draft",
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  await saveProduct(product);
  await logEvent("marketplace_listing_created", { product_id: id, user_id: userId });

  return product;
}