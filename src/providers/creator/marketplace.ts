import fs from "fs/promises";
import path from "path";

const TELEGA_DIR = path.join(process.cwd(), "data", "telega");
const LISTINGS_FILE = path.join(TELEGA_DIR, "market-listings.jsonl");
const REVIEWS_FILE = path.join(TELEGA_DIR, "market-reviews.jsonl");
const ORDERS_FILE = path.join(TELEGA_DIR, "market-orders.jsonl");
const DEAL_CHAT_FILE = path.join(TELEGA_DIR, "market-deal-chat.jsonl");

export type ListingType = "product" | "service";
export type OrderStatus = "pending" | "accepted" | "paid" | "delivered" | "completed" | "cancelled";

export interface Listing {
  listing_id: string;
  type: ListingType;
  owner_user_id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  tags: string[];
  media: string[];
  rating: number;
  reviews_count: number;
  status: "draft" | "pending" | "active" | "paused" | "rejected" | "deleted";
  action_id?: string;
  created_at: number;
  updated_at: number;
}

export interface Review {
  review_id: string;
  listing_id: string;
  reviewer_id: string;
  rating: number;
  text: string;
  is_public: boolean;
  fraud_score: number;
  created_at: number;
}

export interface Order {
  order_id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: OrderStatus;
  price: number;
  currency: string;
  created_at: number;
  updated_at: number;
  completed_at?: number;
}

export interface DealMessage {
  message_id: string;
  order_id: string;
  sender_id: string;
  text: string;
  is_ai_assisted: boolean;
  created_at: number;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(TELEGA_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function appendListing(listing: Listing): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(listing) + "\n";
    await fs.appendFile(LISTINGS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[market] listing write failed", e);
  }
}

export async function appendReview(review: Review): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(review) + "\n";
    await fs.appendFile(REVIEWS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[market] review write failed", e);
  }
}

export async function appendOrder(order: Order): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(order) + "\n";
    await fs.appendFile(ORDERS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[market] order write failed", e);
  }
}

export async function appendDealMessage(msg: DealMessage): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(msg) + "\n";
    await fs.appendFile(DEAL_CHAT_FILE, line, "utf-8");
  } catch (e) {
    console.error("[market] deal message failed", e);
  }
}

export async function loadListings(
  filters?: { type?: ListingType; category?: string; minPrice?: number; maxPrice?: number; minRating?: number },
  limit = 20
): Promise<Listing[]> {
  const listings: Listing[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(LISTINGS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).slice(-limit * 2);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.listing_id && parsed.status === "active") {
          if (filters) {
            if (filters.type && parsed.type !== filters.type) continue;
            if (filters.category && parsed.category !== filters.category) continue;
            if (filters.minPrice && parsed.price < filters.minPrice) continue;
            if (filters.maxPrice && parsed.price > filters.maxPrice) continue;
            if (filters.minRating && parsed.rating < filters.minRating) continue;
          }
          listings.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return listings.sort((a, b) => b.updated_at - a.updated_at);
}

export async function searchListings(query: string, limit = 10): Promise<Listing[]> {
  const all = await loadListings(undefined, 100);
  const q = query.toLowerCase();
  
  return all.filter(l => 
    l.title.toLowerCase().includes(q) ||
    l.description.toLowerCase().includes(q) ||
    l.tags.some(t => t.toLowerCase().includes(q)) ||
    l.category.toLowerCase().includes(q)
  ).slice(0, limit);
}

export async function getListing(listingId: string): Promise<Listing | null> {
  const listings = await loadListings(undefined, 200);
  return listings.find(l => l.listing_id === listingId) || null;
}

export async function createListing(
  userId: string,
  type: ListingType,
  title: string,
  description: string,
  price: number,
  category: string,
  tags: string[] = [],
  currency = "UZS"
): Promise<Listing> {
  const listing: Listing = {
    listing_id: makeId("lst"),
    type,
    owner_user_id: userId,
    title,
    description,
    price,
    currency,
    category,
    tags,
    media: [],
    rating: 0,
    reviews_count: 0,
    status: "pending",
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  await appendListing(listing);
  return listing;
}

export async function publishListing(listingId: string, ownerId: string): Promise<boolean> {
  const listing = await getListing(listingId);
  if (!listing || listing.owner_user_id !== ownerId) return false;
  
  listing.status = "active";
  listing.updated_at = Date.now();
  await appendListing(listing);
  return true;
}

export async function loadReviews(listingId: string, includePrivate = false): Promise<Review[]> {
  const reviews: Review[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(REVIEWS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.listing_id === listingId) {
          if (!includePrivate && !parsed.is_public) continue;
          reviews.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return reviews.sort((a, b) => b.created_at - a.created_at);
}

export async function addReview(
  listingId: string,
  reviewerId: string,
  rating: number,
  text: string
): Promise<Review | null> {
  const listing = await getListing(listingId);
  if (!listing) return null;
  
  const isPublic = rating >= 4;
  const fraudScore = calculateFraudScore(reviewerId, listingId);
  
  const review: Review = {
    review_id: makeId("rev"),
    listing_id: listingId,
    reviewer_id: reviewerId,
    rating: Math.min(5, Math.max(1, rating)),
    text: text.slice(0, 500),
    is_public: isPublic && fraudScore < 0.5,
    fraud_score: fraudScore,
    created_at: Date.now(),
  };
  
  await appendReview(review);
  
  if (fraudScore < 0.5) {
    const reviews = await loadReviews(listingId, true);
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    listing.rating = Math.round(avg * 10) / 10;
    listing.reviews_count = reviews.length;
    listing.updated_at = Date.now();
    await appendListing(listing);
  }
  
  return review;
}

function calculateFraudScore(userId: string, listingId: string): number {
  return 0;
}

export async function createOrder(
  listingId: string,
  buyerId: string
): Promise<Order | null> {
  const listing = await getListing(listingId);
  if (!listing || listing.status !== "active") return null;
  if (listing.owner_user_id === buyerId) return null;
  
  const order: Order = {
    order_id: makeId("ord"),
    listing_id: listingId,
    buyer_id: buyerId,
    seller_id: listing.owner_user_id,
    status: "pending",
    price: listing.price,
    currency: listing.currency,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  
  await appendOrder(order);
  return order;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  userId: string
): Promise<boolean> {
  const orders = await loadOrders(userId);
  const order = orders.find(o => o.order_id === orderId);
  if (!order) return false;
  
  if (order.buyer_id !== userId && order.seller_id !== userId && userId !== "267246987") return false;
  
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    pending: ["accepted", "cancelled"],
    accepted: ["paid", "cancelled"],
    paid: ["delivered"],
    delivered: ["completed"],
    completed: [],
    cancelled: [],
  };
  
  if (!validTransitions[order.status].includes(status)) return false;
  
  order.status = status;
  order.updated_at = Date.now();
  if (status === "completed") order.completed_at = Date.now();
  
  await appendOrder(order);
  return true;
}

export async function loadOrders(userId: string, role?: "buyer" | "seller", limit = 20): Promise<Order[]> {
  const orders: Order[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(ORDERS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).slice(-limit);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.order_id) {
          if (role === "buyer" && parsed.buyer_id !== userId) continue;
          if (role === "seller" && parsed.seller_id !== userId) continue;
          if (!role && parsed.buyer_id !== userId && parsed.seller_id !== userId) continue;
          orders.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return orders.sort((a, b) => b.updated_at - a.updated_at);
}

export async function sendDealMessage(
  orderId: string,
  senderId: string,
  text: string,
  isAiAssisted = false
): Promise<DealMessage | null> {
  const orders = await loadOrders(senderId);
  const order = orders.find(o => o.order_id === orderId);
  if (!order) return null;
  if (order.buyer_id !== senderId && order.seller_id !== senderId) return null;
  
  const msg: DealMessage = {
    message_id: makeId("msg"),
    order_id: orderId,
    sender_id: senderId,
    text: text.slice(0, 1000),
    is_ai_assisted: isAiAssisted,
    created_at: Date.now(),
  };
  
  await appendDealMessage(msg);
  return msg;
}

export async function loadDealMessages(orderId: string, limit = 50): Promise<DealMessage[]> {
  const msgs: DealMessage[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(DEAL_CHAT_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).slice(-limit);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.order_id === orderId) {
          msgs.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return msgs.sort((a, b) => a.created_at - b.created_at);
}

export function formatListing(listing: Listing): string {
  const price = `${listing.price.toLocaleString()} ${listing.currency}`;
  const stars = "⭐".repeat(Math.round(listing.rating)) + "☆".repeat(5 - Math.round(listing.rating));
  
  const lines = [
    `${listing.type === "product" ? "📦" : "🛠️"} ${listing.title}`,
    `ID: ${listing.listing_id}`,
    `Price: ${price}`,
    `Category: ${listing.category}`,
    `Tags: ${listing.tags.join(", ")}`,
    `Rating: ${stars} (${listing.reviews_count})`,
    `Status: ${listing.status}`,
    "",
    listing.description.slice(0, 300),
  ];
  
  return lines.join("\n");
}

export function formatListingList(listings: Listing[]): string {
  if (listings.length === 0) return "No listings found";
  
  const lines = [`🏪 Listings (${listings.length}):\n`];
  for (const l of listings.slice(0, 10)) {
    const icon = l.type === "product" ? "📦" : "🛠️";
    const price = `${l.price.toLocaleString()} ${l.currency}`;
    lines.push(`${icon} ${l.title.slice(0, 40)} - ${price}`);
    lines.push(`   ID: ${l.listing_id} | ⭐ ${l.rating} | ${l.category}`);
  }
  return lines.join("\n");
}

export function formatReview(review: Review, isOwner = false): string {
  const stars = "⭐".repeat(review.rating);
  const visibility = review.is_public ? "🌐 Public" : "🔒 Private";
  const lines = [
    `${stars} Rating: ${review.rating}/5`,
    visibility,
    review.text.slice(0, 200),
    `Date: ${new Date(review.created_at).toLocaleDateString()}`,
  ];
  
  if (isOwner && !review.is_public) {
    lines.push("\n⚠️ This review is private (1-3 stars)");
  }
  
  return lines.join("\n");
}

export function formatOrder(order: Order): string {
  const statusEmoji: Record<OrderStatus, string> = {
    pending: "⏳",
    accepted: "✅",
    paid: "💳",
    delivered: "📦",
    completed: "🎉",
    cancelled: "❌",
  };
  
  const price = `${order.price.toLocaleString()} ${order.currency}`;
  const lines = [
    `${statusEmoji[order.status]} Order: ${order.order_id}`,
    `Listing: ${order.listing_id}`,
    `Price: ${price}`,
    `Status: ${order.status}`,
    `Created: ${new Date(order.created_at).toLocaleString()}`,
  ];
  
  if (order.updated_at !== order.created_at) {
    lines.push(`Updated: ${new Date(order.updated_at).toLocaleString()}`);
  }
  
  return lines.join("\n");
}

export function formatOrderList(orders: Order[]): string {
  if (orders.length === 0) return "No orders found";
  
  const statusEmoji: Record<OrderStatus, string> = {
    pending: "⏳",
    accepted: "✅",
    paid: "💳",
    delivered: "📦",
    completed: "🎉",
    cancelled: "❌",
  };
  
  const lines = [`📋 Orders (${orders.length}):\n`];
  for (const o of orders.slice(0, 10)) {
    lines.push(`${statusEmoji[o.status]} ${o.order_id}: ${o.price} ${o.currency} (${o.status})`);
  }
  return lines.join("\n");
}

export function formatDealChat(messages: DealMessage[], currentUserId: string): string {
  if (messages.length === 0) return "No messages yet";
  
  const lines: string[] = [];
  for (const m of messages.slice(-20)) {
    const sender = m.sender_id === currentUserId ? "You" : m.sender_id.slice(0, 8);
    const ai = m.is_ai_assisted ? " [AI]" : "";
    lines.push(`${sender}${ai}: ${m.text.slice(0, 80)}`);
  }
  
  return lines.join("\n");
}

export function getCategories(): string[] {
  return [
    "electronics",
    "fashion",
    "beauty",
    "home",
    "toys",
    "books",
    "sports",
    "food",
    "services",
    "other",
  ];
}