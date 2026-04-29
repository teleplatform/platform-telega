import fs from "fs/promises";
import path from "path";
import { oblivionByOutcome, tektiteFind } from "./memory-stack.js";

const DATA_DIR = path.join(process.cwd(), "data");
const MARKET_DIR = path.join(DATA_DIR, "marketplace");

interface OptimizationResult {
  type: "product" | "ads" | "pricing" | "seller";
  suggestion: string;
  confidence: number;
  based_on: string[];
  action?: "suggest" | "auto";
}

interface SuccessPattern {
  pattern: string;
  metric: string;
  value: number;
  count: number;
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

async function logEvent(event: string, data: object): Promise<void> {
  const file = path.join(DATA_DIR, "optimization-audit.jsonl");
  await ensureDir(path.dirname(file));
  const line = JSON.stringify({ event, ...data, timestamp: Date.now() });
  await fs.appendFile(file, line + "\n");
}

export async function detectSuccessPatterns(): Promise<SuccessPattern[]> {
  const successOrders = await oblivionByOutcome("success", 20);
  const patterns: Map<string, SuccessPattern> = new Map();

  for (const order of successOrders) {
    const key = order.event;
    if (patterns.has(key)) {
      const existing = patterns.get(key)!;
      existing.count++;
    } else {
      patterns.set(key, {
        pattern: key,
        metric: "order_success",
        value: 1,
        count: 1,
      });
    }
  }

  const result = Array.from(patterns.values())
    .filter((p) => p.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  await logEvent("patterns_detected", { count: result.length });
  return result;
}

export async function optimizeProductCard(
  baseTitle: string,
  baseDescription: string,
  basePrice: number,
  baseTags: string[]
): Promise<{
  optimized_title: string;
  optimized_description: string;
  optimized_price: number;
  optimized_tags: string[];
  confidence: number;
  suggestions: string[];
}> {
  const patterns = await detectSuccessPatterns();
  const suggestions: string[] = [];
  let confidence = 0.5;

  let newTitle = baseTitle;
  let newDescription = baseDescription;
  let newPrice = basePrice;
  let newTags = [...baseTags];

  if (patterns.length > 0) {
    const topPattern = patterns[0];
    confidence = Math.min(0.9, 0.5 + (topPattern.count * 0.05));
    suggestions.push(`Based on ${topPattern.count} successful orders: ${topPattern.pattern}`);

    if (topPattern.count >= 5) {
      newTags.push("popular");
      suggestions.push("Added tag: popular (5+ successful orders)");
    }
  }

  const knowledge = await tektiteFind("pricing", 3);
  if (knowledge.length > 0) {
    for (const k of knowledge) {
      const priceMatch = k.content.match(/(\d+)\s*₽/);
      if (priceMatch) {
        const suggestedPrice = parseInt(priceMatch[1], 10);
        if (suggestedPrice > 0 && suggestedPrice !== basePrice) {
          suggestions.push(`Optimal price from knowledge: ${suggestedPrice}₽`);
          newPrice = suggestedPrice;
        }
      }
    }
  }

  const optimization: OptimizationResult = {
    type: "product",
    suggestion: suggestions.join("; "),
    confidence,
    based_on: patterns.map((p) => p.pattern),
    action: "suggest",
  };

  await logEvent("optimization_detected", optimization);

  return {
    optimized_title: newTitle,
    optimized_description: newDescription,
    optimized_price: newPrice,
    optimized_tags: newTags,
    confidence,
    suggestions,
  };
}

export async function optimizePricing(
  currentPrice: number,
  category: string
): Promise<{
  suggested_price: number;
  reason: string;
  confidence: number;
}> {
  const successOrders = await oblivionByOutcome("success", 20);
  const categoryOrders = successOrders.filter((o: any) => 
    o.event?.toLowerCase().includes(category.toLowerCase())
  );

  if (categoryOrders.length >= 3) {
    const avgPrice = Math.round(
      categoryOrders.reduce((sum: number, o: any) => {
        const match = o.details?.match(/(\d+)/);
        return sum + (match ? parseInt(match[1], 10) : currentPrice);
      }, 0) / categoryOrders.length
    );

    await logEvent("pricing_optimized", {
      category,
      old_price: currentPrice,
      new_price: avgPrice,
    });

    return {
      suggested_price: avgPrice,
      reason: `Based on ${categoryOrders.length} successful ${category} orders`,
      confidence: 0.7,
    };
  }

  const lowerBound = Math.round(currentPrice * 0.85);
  const upperBound = Math.round(currentPrice * 1.15);
  const suggested = Math.round(currentPrice * 0.9);

  return {
    suggested_price: suggested,
    reason: "Default optimization: 10% reduction for better conversion",
    confidence: 0.4,
  };
}

export async function optimizeAds(): Promise<{
  boost: string[];
  pause: string[];
  reason: string;
}> {
  const successEvents = await oblivionByOutcome("success", 50);
  const successAds = successEvents.filter((e: any) => 
    e.event?.startsWith("ad_") || e.event?.includes("campaign")
  );

  const failEvents = await oblivionByOutcome("failure", 50);
  const failAds = failEvents.filter((e: any) => 
    e.event?.startsWith("ad_") || e.event?.includes("campaign")
  );

  const boost = [...new Set(successAds.map((e: any) => e.event))].slice(0, 3);
  const pause = [...new Set(failAds.map((e: any) => e.event))].slice(0, 3);

  if (boost.length > 0 || pause.length > 0) {
    await logEvent("ads_optimized", {
      boost_count: boost.length,
      pause_count: pause.length,
    });
  }

  return {
    boost,
    pause,
    reason: `Boost ${boost.length} winners, pause ${pause.length} underperformers`,
  };
}

export async function getGrowthInsights(): Promise<{
  insights: string[];
  based_on: string;
  confidence: number;
}> {
  const patterns = await detectSuccessPatterns();
  const insights: string[] = [];

  if (patterns.length > 0) {
    insights.push(`Top performer: ${patterns[0].pattern} (${patterns[0].count} orders)`);
  }

  const successCount = (await oblivionByOutcome("success", 100)).length;
  const failCount = (await oblivionByOutcome("failure", 100)).length;
  const conversionRate = successCount / (successCount + failCount || 1);

  if (conversionRate > 0.8) {
    insights.push("Excellent conversion rate (>80%)");
    insights.push("Consider increasing ad budget");
  } else if (conversionRate < 0.5) {
    insights.push("Conversion below 50%");
    insights.push("Review pricing and product descriptions");
  }

  const adsOpt = await optimizeAds();
  if (adsOpt.boost.length > 0) {
    insights.push(`Top ads to boost: ${adsOpt.boost.join(", ")}`);
  }

  const knowledge = await tektiteFind("growth", 2);
  if (knowledge.length > 0) {
    for (const k of knowledge) {
      insights.push(k.content.substring(0, 100));
    }
  }

  await logEvent("growth_insights_generated", {
    insight_count: insights.length,
  });

  return {
    insights,
    based_on: "your real performance data + patterns",
    confidence: Math.min(0.9, 0.5 + (patterns.length * 0.05)),
  };
}

export async function optimizeSellerDashboard(sellerId: string): Promise<{
  stats: { orders: number; revenue: number };
  recommendations: string[];
  next_actions: string[];
}> {
  const patterns = await detectSuccessPatterns();
  const recommendations: string[] = [];
  const nextActions: string[] = [];

  if (patterns.length >= 3) {
    recommendations.push(`Best performing: ${patterns[0].pattern}`);
    nextActions.push("Focus on similar products");
  }

  const pricing = await optimizePricing(5000, "service");
  recommendations.push(pricing.reason);

  await logEvent("seller_optimized", { seller_id: sellerId });

  return {
    stats: { orders: patterns[0]?.count || 0, revenue: 0 },
    recommendations,
    next_actions: nextActions,
  };
}

export async function applyOptimization(
  type: "price" | "tags" | "ad",
  value: string | number
): Promise<{
  applied: boolean;
  result: string;
}> {
  await logEvent("optimization_applied", { type, value });

  return {
    applied: true,
    result: `${type} optimized: ${value}`,
  };
}