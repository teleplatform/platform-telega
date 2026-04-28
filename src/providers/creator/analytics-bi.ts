import fs from "fs/promises";
import path from "path";

const TELEGA_DIR = path.join(process.cwd(), "data", "telega");
const ANALYTICS_FILE = path.join(TELEGA_DIR, "analytics-aggregates.jsonl");

export interface AnalyticsAggregate {
  date: string;
  revenue_total: number;
  orders_count: number;
  avg_order_value: number;
  conversion_rate: number;
  ads_spend: number;
  ads_revenue: number;
  roi: number;
  withdrawals_total: number;
  new_users: number;
  active_users: number;
  top_listing_id?: string;
  top_creator_id?: string;
  created_at: number;
}

export interface InsightWithExplanation {
  metric: string;
  current_value: number;
  previous_value: number;
  change_percent: number;
  trend: "up" | "down" | "stable";
  explanation: string;
  recommendation: string;
  confidence: number;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(TELEGA_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function appendAggregate(data: AnalyticsAggregate): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(data) + "\n";
    await fs.appendFile(ANALYTICS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[analytics] write failed", e);
  }
}

export async function loadAggregates(days = 30): Promise<AnalyticsAggregate[]> {
  const aggregates: AnalyticsAggregate[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(ANALYTICS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.date) {
          aggregates.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return aggregates.sort((a, b) => b.created_at - a.created_at).slice(0, days);
}

export async function computeDailyAnalytics(date?: string): Promise<AnalyticsAggregate> {
  const targetDate = date || new Date().toISOString().split("T")[0];
  
  const { loadOrders } = await import("./marketplace.js");
  const { loadTransactions } = await import("./wallet.js");
  const { loadCampaigns } = await import("./ads-department.js");
  const { loadCurrencies } = await import("./global-expansion.js");
  
  const orders = await loadOrders(undefined as any, undefined, 1000);
  const transactions = await loadTransactions(undefined as any, 1000);
  const campaigns = await loadCampaigns(undefined as any, undefined, 100);
  
  const dayOrders = orders.filter(o => {
    const orderDate = new Date(o.created_at).toISOString().split("T")[0];
    return orderDate === targetDate;
  });
  
  const revenue = dayOrders
    .filter(o => o.status === "completed")
    .reduce((sum, o) => sum + o.price, 0);
  
  const completed = dayOrders.filter(o => o.status === "completed").length;
  const total = dayOrders.length;
  const conversionRate = total > 0 ? (completed / total) * 100 : 0;
  const avgOrderValue = completed > 0 ? revenue / completed : 0;
  
  const dayTxs = transactions.filter(t => {
    const txDate = new Date(t.created_at).toISOString().split("T")[0];
    return txDate === targetDate && (t as any).status === "completed";
  });
  
  const adsSpend = dayTxs
    .filter(t => t.source === "promotion")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const withdrawals = dayTxs
    .filter(t => (t as any).type === "debit" && (t as any).source === "withdrawal")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const adsCampaigns = campaigns.filter(c => {
    const campDate = new Date(c.created_at).toISOString().split("T")[0];
    return campDate === targetDate;
  });
  const adsRevenue = adsCampaigns.reduce((sum, c) => sum + c.metrics?.conversions || 0, 0);
  const roi = adsSpend > 0 ? ((adsRevenue - adsSpend) / adsSpend) * 100 : 0;
  
  const aggregate: AnalyticsAggregate = {
    date: targetDate,
    revenue_total: revenue,
    orders_count: dayOrders.length,
    avg_order_value: avgOrderValue,
    conversion_rate: conversionRate,
    ads_spend: adsSpend,
    ads_revenue: adsRevenue,
    roi,
    withdrawals_total: withdrawals,
    new_users: 0,
    active_users: new Set(dayOrders.map(o => o.buyer_id)).size,
    created_at: Date.now(),
  };
  
  await appendAggregate(aggregate);
  return aggregate;
}

export async function getInsights(metric?: string): Promise<InsightWithExplanation[]> {
  const aggregates = await loadAggregates(7);
  const insights: InsightWithExplanation[] = [];
  
  if (aggregates.length < 2) return insights;
  
  const latest = aggregates[0];
  const previous = aggregates[1];
  
  const metrics = metric ? [metric] : [
    "revenue_total",
    "orders_count",
    "conversion_rate",
    "ads_spend",
    "roi",
    "withdrawals_total",
  ];
  
  for (const m of metrics) {
    const currentVal = (latest as any)[m] || 0;
    const prevVal = (previous as any)[m] || 0;
    const change = prevVal > 0 ? ((currentVal - prevVal) / prevVal) * 100 : 0;
    
    const trend: "up" | "down" | "stable" = 
      change > 5 ? "up" : change < -5 ? "down" : "stable";
    
    const explanation = generateExplanation(m, currentVal, prevVal, change, trend);
    const recommendation = generateRecommendation(m, trend, currentVal, prevVal);
    
    insights.push({
      metric: m,
      current_value: currentVal,
      previous_value: prevVal,
      change_percent: Math.round(change * 100) / 100,
      trend,
      explanation,
      recommendation,
      confidence: Math.min(1, aggregates.length / 7),
    });
  }
  
  return insights;
}

function generateExplanation(
  metric: string,
  current: number,
  previous: number,
  change: number,
  trend: string
): string {
  const changeText = change > 0 ? `выросло на ${Math.abs(change).toFixed(1)}%` : 
                   change < 0 ? `упало на ${Math.abs(change).toFixed(1)}%` : "без изменений";
  
  const reasons: Record<string, string[]> = {
    revenue_total: [
      `Выручка ${changeText}.`,
      change < -20 ? "Возможные причины: остановлены кампании, снижение CTR, конкуренты снизили цены." :
      change > 20 ? "Факторы роста: активные кампании, высокий CTR, удачные креативы." :
      "Стабильные показатели."
    ],
    orders_count: [
      `Количество заказов ${changeText}.`,
      change < -15 ? "Причины: меньше трафика, слабые объявления, высокие цены." :
      change > 15 ? "Рост: больше трафика, удачные акции, привлекательные цены." :
      "Стабильный поток заказов."
    ],
    conversion_rate: [
      `Конверсия ${changeText}.`,
      change < -10 ? "Проблема: плохое описание товара, высокая цена, нет отзывов." :
      change > 10 ? "Улучшение: качественные фото, хорошие отзывы, адекватная цена." :
      "Конверсия в норме."
    ],
    ads_spend: [
      `Расходы на рекламу ${changeText}.`,
      change > 30 ? "Внимание: резкий рост расходов. Проверьте эффективность кампаний." :
      change < -30 ? "Снижение: кампании остановлены или исчерпан бюджет." :
      "Расходы в пределах нормы."
    ],
    roi: [
      `ROI ${changeText}.`,
      change < -20 ? "Проблема: реклама не окупается. Срочно оптимизируйте кампании!" :
      change > 20 ? "Отлично: реклама работает эффективно." :
      "ROI стабилен."
    ],
    withdrawals_total: [
      `Вывод средств ${changeText}.`,
      change > 50 ? "Резкий рост выводов. Проверьте баланс Teleton." :
      "Выводы в пределах нормы."
    ],
  };
  
  return reasons[metric]?.join(" ") || `${metric} ${changeText}.`;
}

function generateRecommendation(
  metric: string,
  trend: string,
  current: number,
  previous: number
): string {
  const recommendations: Record<string, Record<string, string>> = {
    revenue_total: {
      down: "1. Проверьте статус кампаний (/ads_status)\n2. Обновите описания топ-товаров\n3. Запустите новые рекламные кампании",
      up: "1. Поддерживайте активные кампании\n2. Масштабируйте успешные креативы\n3. Увеличьте бюджет на 20%",
      stable: "1. Протестируйте новые гипотезы\n2. Оптимизируйте цены\n3. Улучшите описания товаров",
    },
    orders_count: {
      down: "1. Увеличьте рекламный бюджет\n2. Проверьте видимость товаров\n3. Добавьте акции/скидки",
      up: "1. Поддерживайте темп\n2. Расширяйте ассортимент\n3. Работайте с отзывами",
      stable: "1. Тестируйте новые каналы трафика\n2. Улучшайте конверсию\n3. Работайте с постоянными клиентами",
    },
    conversion_rate: {
      down: "1. Обновите фото товаров\n2. Добавьте больше деталей в описание\n3. Проверьте цены конкурентов",
      up: "1. Сохраняйте текущие методы\n2. Делитесь опытом с другими\n3. Масштабируйте успешные практики",
      stable: "1. A/B тестируйте описания\n2. Добавьте видео-обзоры\n3. Работайте над доверием (отзывы)",
    },
    ads_spend: {
      down: "1. Проверьте настройки кампаний\n2. Увеличьте дневной бюджет\n3. Запустите новые кампании",
      up: "1. Отключите неэффективные креативы\n2. Снизьте ставку клика\n3. Перераспределите бюджет на лучшие товары",
      stable: "1. Тестируйте новые гипотезы\n2. Следите за CPA\n3. Оптимизируйте регулярно",
    },
    roi: {
      down: "1. Срочно оптимизируйте кампании!\n2. Смените креативы\n3. Пересмотрите таргетинг",
      up: "1. Увеличьте бюджет успешных кампаний\n2. Масштабируйте стратегию\n3. Добавьте похожие товары",
      stable: "1. Постоянно тестируйте новое\n2. Следите за конкурентами\n3. Оптимизируйте каждые 24 часа",
    },
    withdrawals_total: {
      down: "1. Стимулируйте продажи\n2. Запустите акции\n3. Увеличьте трафик",
      up: "1. Следите за балансом Teleton\n2. Планируйте выводы равномерно\n3. Реинвестируйте часть прибыли",
      stable: "1. Поддерживайте стабильность\n2. Формируйте резервный фонд\n3. Планируйте развитие",
    },
  };
  
  return recommendations[metric]?.[trend] || "Продолжайте мониторинг.";
}

export function formatAnalyticsAggregate(a: AnalyticsAggregate): string {
  const lines = [
    `📊 Analytics for ${a.date}:`,
    "",
    `💰 Revenue: ${a.revenue_total.toLocaleString()} TN`,
    `📋 Orders: ${a.orders_count} (avg: ${a.avg_order_value.toFixed(0)} TN)`,
    `📈 Conversion: ${a.conversion_rate.toFixed(1)}%`,
    `📢 Ads Spend: ${a.ads_spend.toLocaleString()} TN`,
    `📊 Ads Revenue: ${a.ads_revenue.toLocaleString()} TN`,
    `🚀 ROI: ${a.roi.toFixed(1)}%`,
    `💳 Withdrawals: ${a.withdrawals_total.toLocaleString()} TN`,
    `👤 Active Users: ${a.active_users}`,
  ];
  return lines.join("\n");
}

export function formatInsight(insight: InsightWithExplanation): string {
  const trendEmoji = insight.trend === "up" ? "📈" : insight.trend === "down" ? "📉" : "➡️";
  const lines = [
    `${trendEmoji} ${insight.metric}: ${insight.current_value.toLocaleString()} (${insight.change_percent > 0 ? "+" : ""}${insight.change_percent}%)`,
    "",
    `🧠 Why: ${insight.explanation}`,
    "",
    `💡 Recommendation:`,
    insight.recommendation.split("\n").map(r => `  ${r}`).join("\n"),
    "",
    `Confidence: ${(insight.confidence * 100).toFixed(0)}%`,
  ];
  return lines.join("\n");
}

export function formatInsightsList(insights: InsightWithExplanation[]): string {
  if (insights.length === 0) return "Not enough data yet";
  
  return insights.map((i, idx) => `${idx + 1}. ${formatInsight(i)}`).join("\n\n---\n\n");
}

export async function getTopListings(limit = 5): Promise<string[]> {
  const { loadListings } = await import("./marketplace.js");
  const listings = await loadListings(undefined, undefined);
  
  return listings
    .sort((a, b) => b.rating * b.reviews_count - a.rating * a.reviews_count)
    .slice(0, limit)
    .map(l => l.listing_id);
}

export async function getTopCreators(limit = 5): Promise<string[]> {
  const { loadCreatorProfiles } = await import("./creator-economy.js");
  const profiles = await loadCreatorProfiles(100);
  
  return profiles
    .sort((a, b) => b.followers - a.followers)
    .slice(0, limit)
    .map(p => p.user_id);
}

export function formatTopCreators(ids: string[]): string {
  if (ids.length === 0) return "No data yet";
  
  const lines = ["🏆 Top Creators:\n"];
  ids.forEach((id, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
    lines.push(`${medal} ${id}`);
  });
  
  return lines.join("\n");
}

export function formatTopListings(ids: string[]): string {
  if (ids.length === 0) return "No data yet";
  
  const lines = ["📦 Top Listings:\n"];
  ids.forEach((id, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
    lines.push(`${medal} ${id}`);
  });
  
  return lines.join("\n");
}
