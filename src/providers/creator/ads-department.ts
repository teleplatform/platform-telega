import fs from "fs/promises";
import path from "path";

const TELEGA_DIR = path.join(process.cwd(), "data", "telega");
const CAMPAIGNS_FILE = path.join(TELEGA_DIR, "ads-campaigns.jsonl");
const CREATIVES_FILE = path.join(TELEGA_DIR, "ads-creatives.jsonl");
const TARGETING_FILE = path.join(TELEGA_DIR, "ads-targeting.jsonl");

export type AdStatus = "draft" | "pending" | "active" | "paused" | "completed" | "cancelled";
export type AdChannel = "telegram_channel" | "internal_feed" | "story" | "post";

export interface AdCampaign {
  campaign_id: string;
  listing_id: string;
  owner_user_id: string;
  name: string;
  budget_teleton: number;
  spent_teleton: number;
  channels: AdChannel[];
  status: AdStatus;
  targeting: TargetingProfile;
  metrics: CampaignMetrics;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  optimization_score: number;
}

export interface AdCreative {
  creative_id: string;
  campaign_id: string;
  type: "text" | "image" | "video" | "story";
  content: string;
  headline?: string;
  cta?: string;
  impressions: number;
  clicks: number;
  conversions: number;
  status: "active" | "paused" | "completed";
  created_at: number;
}

export interface TargetingProfile {
  interests?: string[];
  behavior?: string[];
  geo?: string[];
  segments?: string[];
}

export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  cpa: number;
  ctr: number;
  cvr: number;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(TELEGA_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function appendCampaign(campaign: AdCampaign): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(campaign) + "\n";
    await fs.appendFile(CAMPAIGNS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[ads] campaign write failed", e);
  }
}

export async function appendCreative(creative: AdCreative): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(creative) + "\n";
    await fs.appendFile(CREATIVES_FILE, line, "utf-8");
  } catch (e) {
    console.error("[ads] creative write failed", e);
  }
}

export async function loadCampaigns(userId?: string, status?: AdStatus, limit = 20): Promise<AdCampaign[]> {
  const campaigns: AdCampaign[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(CAMPAIGNS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).slice(-limit * 2);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.campaign_id) {
          if (userId && parsed.owner_user_id !== userId) continue;
          if (status && parsed.status !== status) continue;
          campaigns.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return campaigns.sort((a, b) => b.created_at - a.created_at);
}

export async function getCampaign(campaignId: string): Promise<AdCampaign | null> {
  const campaigns = await loadCampaigns(undefined, undefined, 100);
  return campaigns.find(c => c.campaign_id === campaignId) || null;
}

export async function createCampaign(
  userId: string,
  listingId: string,
  name: string,
  budget: number,
  channels: AdChannel[],
  targeting: TargetingProfile = {}
): Promise<AdCampaign> {
  const campaign: AdCampaign = {
    campaign_id: makeId("ad"),
    listing_id: listingId,
    owner_user_id: userId,
    name,
    budget_teleton: budget,
    spent_teleton: 0,
    channels,
    status: "pending",
    targeting,
    metrics: {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      spend: 0,
      cpa: 0,
      ctr: 0,
      cvr: 0,
    },
    created_at: Date.now(),
    optimization_score: 0.5,
  };
  
  await appendCampaign(campaign);
  
  await generateCreatives(campaign);
  
  return campaign;
}

export async function startCampaign(campaignId: string, userId: string): Promise<boolean> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return false;
  if (campaign.owner_user_id !== userId && userId !== "267246987") return false;
  
  const { checkUserLimit, spendTeleton } = await import("./wallet.js");
  const check = await checkUserLimit(userId, campaign.budget_teleton);
  
  if (!check.allowed) {
    console.error("[ads] insufficient funds", check);
    return false;
  }
  
  campaign.status = "active";
  campaign.started_at = Date.now();
  await appendCampaign(campaign);
  
  return true;
}

export async function pauseCampaign(campaignId: string, userId: string): Promise<boolean> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return false;
  if (campaign.owner_user_id !== userId && userId !== "267246987") return false;
  
  campaign.status = "paused";
  await appendCampaign(campaign);
  return true;
}

export async function completeCampaign(campaignId: string, userId: string): Promise<boolean> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return false;
  if (campaign.owner_user_id !== userId && userId !== "267246987") return false;
  
  campaign.status = "completed";
  campaign.completed_at = Date.now();
  await appendCampaign(campaign);
  
  return true;
}

export async function generateCreatives(campaign: AdCampaign): Promise<AdCreative[]> {
  const { getListing } = await import("./marketplace.js");
  const listing = await getListing(campaign.listing_id);
  
  if (!listing) return [];
  
  const headlines = [
    `Купить ${listing.title} - Акция`,
    `${listing.title} - Лучшая цена`,
    `Спешите! ${listing.title} по выгодной цене`,
    listing.title,
  ];
  
  const descriptions = [
    listing.description.slice(0, 150),
    `${listing.description.slice(0, 100)}... Доставка по всей России!`,
    `${listing.title} за ${listing.price} ${listing.currency}. Качество гарантировано!`,
  ];
  
  const creatives: AdCreative[] = [];
  
  for (let i = 0; i < 3; i++) {
    const creative: AdCreative = {
      creative_id: makeId("cr"),
      campaign_id: campaign.campaign_id,
      type: "text",
      content: descriptions[i % descriptions.length],
      headline: headlines[i % headlines.length],
      cta: "Купить",
      impressions: 0,
      clicks: 0,
      conversions: 0,
      status: "active",
      created_at: Date.now(),
    };
    
    await appendCreative(creative);
    creatives.push(creative);
  }
  
  return creatives;
}

export async function loadCreatives(campaignId: string): Promise<AdCreative[]> {
  const creatives: AdCreative[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(CREATIVES_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.campaign_id === campaignId) {
          creatives.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return creatives;
}

export async function trackImpression(
  campaignId: string,
  creativeId: string,
  event: "impression" | "click" | "conversion"
): Promise<void> {
  const campaign = await getCampaign(campaignId);
  const creatives = await loadCreatives(campaignId);
  const creative = creatives.find(c => c.creative_id === creativeId);
  
  if (!campaign || !creative) return;
  
  if (event === "impression") {
    campaign.metrics.impressions++;
    creative.impressions++;
    campaign.metrics.ctr = campaign.metrics.impressions > 0 
      ? (campaign.metrics.clicks / campaign.metrics.impressions) * 100 
      : 0;
  } else if (event === "click") {
    campaign.metrics.clicks++;
    creative.clicks++;
    campaign.metrics.ctr = campaign.metrics.impressions > 0 
      ? (campaign.metrics.clicks / campaign.metrics.impressions) * 100 
      : 0;
  } else if (event === "conversion") {
    campaign.metrics.conversions++;
    creative.conversions++;
    campaign.metrics.cpa = campaign.metrics.conversions > 0 
      ? campaign.metrics.spend / campaign.metrics.conversions 
      : 0;
    campaign.metrics.cvr = campaign.metrics.clicks > 0 
      ? (campaign.metrics.conversions / campaign.metrics.clicks) * 100 
      : 0;
  }
  
  await appendCampaign(campaign);
  
  const creIdx = creatives.findIndex(c => c.creative_id === creativeId);
  if (creIdx >= 0) {
    creatives[creIdx] = creative;
  }
}

export async function optimizeCampaign(campaignId: string): Promise<{ action: string; reason: string }> {
  const campaign = await getCampaign(campaignId);
  if (!campaign || campaign.status !== "active") {
    return { action: "none", reason: "campaign not active" };
  }
  
  const creatives = await loadCreatives(campaignId);
  
  if (creatives.length === 0) {
    return { action: "none", reason: "no creatives" };
  }
  
  const bestCreative = creatives.reduce((best, c) => {
    const bestCtr = best.clicks / Math.max(best.impressions, 1);
    const cCtr = c.clicks / Math.max(c.impressions, 1);
    return cCtr > bestCtr ? c : best;
  }, creatives[0]);
  
  const worstCreative = creatives.reduce((worst, c) => {
    const worstCtr = worst.clicks / Math.max(worst.impressions, 1);
    const cCtr = c.clicks / Math.max(c.impressions, 1);
    return cCtr < worstCtr ? c : worst;
  }, creatives[0]);
  
  const bestCtr = bestCreative.clicks / Math.max(bestCreative.impressions, 1);
  const worstCtr = worstCreative.clicks / Math.max(worstCreative.impressions, 1);
  
  if (bestCtr > 0.1 && worstCtr < 0.01 && creatives.length > 1) {
    worstCreative.status = "paused";
    await appendCreative(worstCreative);
    
    await generateCreatives(campaign);
    
    campaign.optimization_score = Math.min(1, campaign.optimization_score + 0.1);
    await appendCampaign(campaign);
    
    return { action: "paused_worst", reason: `Paused worst creative, generated new. Score: ${campaign.optimization_score.toFixed(2)}` };
  }
  
  if (campaign.metrics.cpa > 0 && campaign.metrics.cpa > (campaign.budget_teleton * 0.1)) {
    return { action: "review_budget", reason: `CPA too high: ${campaign.metrics.cpa.toFixed(0)}. Review budget.` };
  }
  
  campaign.optimization_score = Math.min(1, campaign.optimization_score + 0.05);
  await appendCampaign(campaign);
  
  return { action: "optimized", reason: `Score: ${campaign.optimization_score.toFixed(2)}` };
}

export function formatCampaign(campaign: AdCampaign): string {
  const statusEmoji: Record<AdStatus, string> = {
    draft: "📝",
    pending: "⏳",
    active: "🟢",
    paused: "🟡",
    completed: "✅",
    cancelled: "❌",
  };
  
  const m = campaign.metrics;
  const cpa = m.conversions > 0 ? (m.spend / m.conversions).toFixed(0) : "N/A";
  
  const lines = [
    `${statusEmoji[campaign.status]} Campaign: ${campaign.name}`,
    `ID: ${campaign.campaign_id}`,
    `Listing: ${campaign.listing_id}`,
    `Budget: ${campaign.budget_teleton} TN`,
    `Spent: ${campaign.spent_teleton} TN`,
    `Status: ${campaign.status}`,
    "",
    `📊 Metrics:`,
    `  Impressions: ${m.impressions.toLocaleString()}`,
    `  Clicks: ${m.clicks.toLocaleString()} (CTR: ${m.ctr.toFixed(1)}%)`,
    `  Conversions: ${m.conversions.toLocaleString()} (CVR: ${m.cvr.toFixed(1)}%)`,
    `  CPA: ${cpa} TN`,
    "",
    `🎯 Optimization: ${(campaign.optimization_score * 100).toFixed(0)}%`,
  ];
  
  return lines.join("\n");
}

export function formatCampaignList(campaigns: AdCampaign[]): string {
  if (campaigns.length === 0) return "No campaigns found";
  
  const statusEmoji: Record<AdStatus, string> = {
    draft: "📝",
    pending: "⏳",
    active: "🟢",
    paused: "🟡",
    completed: "✅",
    cancelled: "❌",
  };
  
  const lines = [`📢 Ad Campaigns (${campaigns.length}):\n`];
  for (const c of campaigns.slice(0, 10)) {
    lines.push(`${statusEmoji[c.status]} ${c.name}: ${c.spent_teleton}/${c.budget_teleton} TN`);
    lines.push(`   ID: ${c.campaign_id} | ${c.metrics.clicks} clicks | ${c.metrics.conversions} conv`);
  }
  return lines.join("\n");
}

export function formatCreative(creative: AdCreative): string {
  const ctr = creative.impressions > 0 ? ((creative.clicks / creative.impressions) * 100).toFixed(1) : "0";
  
  const lines = [
    `📝 Creative: ${creative.type}`,
    `ID: ${creative.creative_id}`,
    `Headline: ${creative.headline || "N/A"}`,
    `Content: ${creative.content.slice(0, 100)}...`,
    `CTA: ${creative.cta || "N/A"}`,
    `Status: ${creative.status}`,
    `Impressions: ${creative.impressions} | Clicks: ${creative.clicks} (CTR: ${ctr}%)`,
    `Conversions: ${creative.conversions}`,
  ];
  
  return lines.join("\n");
}