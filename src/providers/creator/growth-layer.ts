import fs from "fs/promises";
import path from "path";

const TELEGA_DIR = path.join(process.cwd(), "data", "telega");
const CAMPAIGNS_FILE = path.join(TELEGA_DIR, "atlas-campaigns.jsonl");
const IMPRESSIONS_FILE = path.join(TELEGA_DIR, "atlas-impressions.jsonl");
const SERVICES_FILE = path.join(TELEGA_DIR, "talent-services.jsonl");
const INSIGHTS_FILE = path.join(TELEGA_DIR, "growth-insights.jsonl");

export type CampaignStatus = "draft" | "pending" | "active" | "paused" | "completed" | "cancelled";
export type ChannelType = "telegram_channel" | "internal_feed" | "ad_slot";

export interface Campaign {
  campaign_id: string;
  action_id: string;
  user_id: string;
  name: string;
  channel: ChannelType;
  target_segment?: string;
  frequency_cap: number;
  impressions_total: number;
  impressions_current: number;
  clicks: number;
  conversions: number;
  status: CampaignStatus;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  cost_per_action?: number;
}

export interface Impression {
  impression_id: string;
  campaign_id: string;
  action_id: string;
  user_id: string;
  channel: ChannelType;
  timestamp: number;
  event: "impression" | "click" | "conversion";
  metadata?: Record<string, any>;
}

export interface Service {
  service_id: string;
  user_id: string;
  name: string;
  description: string;
  price?: number;
  currency?: string;
  category: string;
  portfolio_links?: string[];
  action_ids?: string[];
  status: "active" | "paused" | "draft";
  created_at: number;
}

export interface Insight {
  insight_id: string;
  user_id: string;
  type: "drop_analysis" | "improvement" | "ab_test" | "price_recommendation" | "keyword_recommendation";
  target_id: string;
  target_type: "product" | "content" | "campaign" | "service";
  content: string;
  confidence: number;
  action_items?: string[];
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

export async function appendCampaign(campaign: Campaign): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(campaign) + "\n";
    await fs.appendFile(CAMPAIGNS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[atlas] campaign write failed", e);
  }
}

export async function appendImpression(impression: Impression): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(impression) + "\n";
    await fs.appendFile(IMPRESSIONS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[atlas] impression write failed", e);
  }
}

export async function appendService(service: Service): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(service) + "\n";
    await fs.appendFile(SERVICES_FILE, line, "utf-8");
  } catch (e) {
    console.error("[talent] service write failed", e);
  }
}

export async function appendInsight(insight: Insight): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(insight) + "\n";
    await fs.appendFile(INSIGHTS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[growth] insight write failed", e);
  }
}

export async function loadCampaigns(userId?: string, status?: CampaignStatus, limit = 20): Promise<Campaign[]> {
  const campaigns: Campaign[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(CAMPAIGNS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).slice(-limit * 2);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.campaign_id) {
          if (userId && parsed.user_id !== userId) continue;
          if (status && parsed.status !== status) continue;
          campaigns.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return campaigns.sort((a, b) => b.created_at - a.created_at);
}

export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  const campaigns = await loadCampaigns(undefined, undefined, 100);
  return campaigns.find(c => c.campaign_id === campaignId) || null;
}

export async function createCampaign(
  userId: string,
  actionId: string,
  name: string,
  channel: ChannelType,
  frequencyCap = 3,
  targetSegment?: string
): Promise<Campaign> {
  const campaign: Campaign = {
    campaign_id: makeId("cmp"),
    action_id: actionId,
    user_id: userId,
    name,
    channel,
    target_segment: targetSegment,
    frequency_cap: frequencyCap,
    impressions_total: 0,
    impressions_current: 0,
    clicks: 0,
    conversions: 0,
    status: "draft",
    created_at: Date.now(),
  };
  await appendCampaign(campaign);
  return campaign;
}

export async function startCampaign(campaignId: string, userId: string): Promise<boolean> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return false;
  if (campaign.user_id !== userId && userId !== "267246987") return false;
  
  campaign.status = "active";
  campaign.started_at = Date.now();
  await appendCampaign(campaign);
  return true;
}

export async function pauseCampaign(campaignId: string, userId: string): Promise<boolean> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return false;
  if (campaign.user_id !== userId && userId !== "267246987") return false;
  
  campaign.status = "paused";
  await appendCampaign(campaign);
  return true;
}

export async function stopCampaign(campaignId: string, userId: string): Promise<boolean> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return false;
  if (campaign.user_id !== userId && userId !== "267246987") return false;
  
  campaign.status = "completed";
  campaign.completed_at = Date.now();
  await appendCampaign(campaign);
  return true;
}

export async function trackImpression(
  campaignId: string,
  actionId: string,
  userId: string,
  channel: ChannelType,
  event: Impression["event"]
): Promise<void> {
  const impression: Impression = {
    impression_id: makeId("imp"),
    campaign_id: campaignId,
    action_id: actionId,
    user_id: userId,
    channel,
    timestamp: Date.now(),
    event,
  };
  
  await appendImpression(impression);
  
  const campaign = await getCampaign(campaignId);
  if (campaign) {
    if (event === "impression") {
      campaign.impressions_current++;
      campaign.impressions_total++;
    } else if (event === "click") {
      campaign.clicks++;
    } else if (event === "conversion") {
      campaign.conversions++;
    }
    await appendCampaign(campaign);
  }
}

export function formatCampaign(campaign: Campaign): string {
  const statusEmoji: Record<CampaignStatus, string> = {
    draft: "📝",
    pending: "⏳",
    active: "🟢",
    paused: "🟡",
    completed: "✅",
    cancelled: "❌",
  };
  
  const ctr = campaign.impressions_total > 0 ? ((campaign.clicks / campaign.impressions_total) * 100).toFixed(1) : "0";
  const cvr = campaign.clicks > 0 ? ((campaign.conversions / campaign.clicks) * 100).toFixed(1) : "0";
  
  const lines = [
    `${statusEmoji[campaign.status]} Campaign: ${campaign.name}`,
    `ID: ${campaign.campaign_id}`,
    `Action: ${campaign.action_id}`,
    `Channel: ${campaign.channel}`,
    `Status: ${campaign.status}`,
    `Impressions: ${campaign.impressions_current}/${campaign.impressions_total}`,
    `Clicks: ${campaign.clicks} (CTR: ${ctr}%)`,
    `Conversions: ${campaign.conversions} (CVR: ${cvr}%)`,
  ];
  
  if (campaign.cost_per_action) {
    lines.push(`Cost/Action: $${campaign.cost_per_action}`);
  }
  
  return lines.join("\n");
}

export function formatCampaignList(campaigns: Campaign[]): string {
  if (campaigns.length === 0) return "No campaigns found";
  
  const statusEmoji: Record<CampaignStatus, string> = {
    draft: "📝",
    pending: "⏳",
    active: "🟢",
    paused: "🟡",
    completed: "✅",
    cancelled: "❌",
  };
  
  const lines = [`📢 Campaigns (${campaigns.length}):\n`];
  for (const c of campaigns.slice(0, 10)) {
    lines.push(`${statusEmoji[c.status]} ${c.name}: ${c.impressions_current} imp, ${c.clicks} clicks`);
    lines.push(`   ID: ${c.campaign_id} | ${c.channel}`);
  }
  return lines.join("\n");
}

export async function createService(
  userId: string,
  name: string,
  description: string,
  category: string,
  price?: number,
  currency: string = "UZS",
  actionIds?: string[]
): Promise<Service> {
  const service: Service = {
    service_id: makeId("svc"),
    user_id: userId,
    name,
    description,
    price,
    currency,
    category,
    portfolio_links: [],
    action_ids: actionIds,
    status: "active",
    created_at: Date.now(),
  };
  await appendService(service);
  return service;
}

export async function loadServices(userId?: string, limit = 20): Promise<Service[]> {
  const services: Service[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(SERVICES_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).slice(-limit);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.service_id) {
          if (!userId || parsed.user_id === userId) {
            services.push(parsed);
          }
        }
      } catch {}
    }
  } catch {}
  return services.sort((a, b) => b.created_at - a.created_at);
}

export function formatService(service: Service): string {
  const price = service.price ? `${service.price} ${service.currency || "UZS"}` : "Price on request";
  
  const lines = [
    `🛠️ Service: ${service.name}`,
    `ID: ${service.service_id}`,
    `Category: ${service.category}`,
    `Price: ${price}`,
    `Description: ${service.description}`,
    `Status: ${service.status}`,
  ];
  
  if (service.action_ids?.length) {
    lines.push(`Linked actions: ${service.action_ids.join(", ")}`);
  }
  
  return lines.join("\n");
}

export function formatServiceList(services: Service[]): string {
  if (services.length === 0) return "No services found";
  
  const lines = [`🛠️ Services (${services.length}):\n`];
  for (const s of services.slice(0, 10)) {
    const price = s.price ? `${s.price} ${s.currency || "UZS"}` : "Price on request";
    lines.push(`• ${s.name} - ${price}`);
    lines.push(`  ID: ${s.service_id} | ${s.category}`);
  }
  return lines.join("\n");
}

export async function generateInsight(
  userId: string,
  type: Insight["type"],
  targetId: string,
  targetType: Insight["target_type"],
  content: string,
  confidence: number,
  actionItems?: string[]
): Promise<Insight> {
  const insight: Insight = {
    insight_id: makeId("ins"),
    user_id: userId,
    type,
    target_id: targetId,
    target_type: targetType,
    content,
    confidence,
    action_items: actionItems,
    created_at: Date.now(),
  };
  await appendInsight(insight);
  return insight;
}

export async function loadInsights(userId: string, limit = 10): Promise<Insight[]> {
  const insights: Insight[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(INSIGHTS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).slice(-limit);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.insight_id && parsed.user_id === userId) {
          insights.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return insights.sort((a, b) => b.created_at - a.created_at);
}

export function formatInsight(insight: Insight): string {
  const typeLabels: Record<Insight["type"], string> = {
    drop_analysis: "📉 Drop Analysis",
    improvement: "💡 Improvement",
    ab_test: "🧪 A/B Test",
    price_recommendation: "💰 Price",
    keyword_recommendation: "🔑 Keywords",
  };
  
  const lines = [
    `${typeLabels[insight.type]} - ${insight.target_type}: ${insight.target_id}`,
    `Confidence: ${(insight.confidence * 100).toFixed(0)}%`,
    "",
    insight.content,
  ];
  
  if (insight.action_items?.length) {
    lines.push("\n📋 Action Items:");
    for (const item of insight.action_items) {
      lines.push(`• ${item}`);
    }
  }
  
  return lines.join("\n");
}

export function generateDropAnalysis(metrics: { impressions: number; clicks: number; conversions: number; previousPeriod: number }): string {
  const dropRate = ((metrics.previousPeriod - metrics.impressions) / metrics.previousPeriod * 100).toFixed(1);
  
  if (parseFloat(dropRate) > 30) {
    return `⚠️ Significant drop detected: ${dropRate}% fewer impressions vs previous period.

Possible causes:
• Content fatigue - consider refreshing titles/descriptions
• Search ranking change - review keywords
• Algorithm change - check platform updates
• Competition increase - analyze competitorActivity

Recommended actions:
1. Refresh product card with new images
2. A/B test descriptions
3. Research competitor keywords
4. Increase promotion budget temporarily`;
  }
  
  return `ℹ️ Performance stable. Drop of ${dropRate}% is within normal range.

Keep monitoring and continue A/B testing.`;
}

export function generateABTestSuggestion(productId: string): { titleA: string; titleB: string; descriptionA: string; descriptionB: string } {
  return {
    titleA: `Купить ${productId} - Официальный магазин`,
    titleB: `${productId} - Качество с гарантией`,
    descriptionA: `Качественный ${productId}. Доставка по всей России. Гарантия. Оплата при получении.`,
    descriptionB: `${productId} по лучшей цене. Официальная гарантия. Быстрая доставка. Отзывы покупателей.`,
  };
}