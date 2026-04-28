import fs from "fs/promises";
import path from "path";

const TELEGA_DIR = path.join(process.cwd(), "data", "telega");
const REFERRALS_FILE = path.join(TELEGA_DIR, "referrals.jsonl");
const PARTNERS_FILE = path.join(TELEGA_DIR, "partners.jsonl");
const CREATOR_PROFILES_FILE = path.join(TELEGA_DIR, "creator-profiles.jsonl");

export type ReferralStatus = "pending" | "active" | "paid";
export type PartnerStatus = "active" | "paused" | "cancelled";

export interface Referral {
  referral_id: string;
  code: string;
  owner_user_id: string;
  invited_user_id: string;
  reward_teleton: number;
  lifetime_value: number;
  status: ReferralStatus;
  created_at: number;
  activated_at?: number;
}

export interface Partner {
  partner_id: string;
  owner_user_id: string;
  commission_rate: number;
  earnings_teleton: number;
  total_payouts: number;
  status: PartnerStatus;
  created_at: number;
  last_payout_at?: number;
}

export interface CreatorProfile {
  user_id: string;
  bio: string;
  links: string[];
  rating: number;
  total_sales: number;
  followers: number;
  referral_code: string;
  is_partner: boolean;
  created_at: number;
  updated_at: number;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeReferralCode(userId: string): string {
  return `REF${userId.slice(0, 6).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(TELEGA_DIR, { recursive: true });
  } catch {}
}

async function appendReferral(referral: Referral): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(referral) + "\n";
    await fs.appendFile(REFERRALS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[referral] write failed", e);
  }
}

async function appendPartner(partner: Partner): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(partner) + "\n";
    await fs.appendFile(PARTNERS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[partner] write failed", e);
  }
}

async function appendCreatorProfile(profile: CreatorProfile): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(profile) + "\n";
    await fs.appendFile(CREATOR_PROFILES_FILE, line, "utf-8");
  } catch (e) {
    console.error("[creator] profile write failed", e);
  }
}

export async function loadReferrals(userId?: string): Promise<Referral[]> {
  const referrals: Referral[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(REFERRALS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.referral_id) {
          if (!userId || parsed.owner_user_id === userId) {
            referrals.push(parsed);
          }
        }
      } catch {}
    }
  } catch {}
  return referrals.sort((a, b) => b.created_at - a.created_at);
}

export async function loadPartners(userId?: string): Promise<Partner[]> {
  const partners: Partner[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(PARTNERS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.partner_id) {
          if (!userId || parsed.owner_user_id === userId) {
            partners.push(parsed);
          }
        }
      } catch {}
    }
  } catch {}
  return partners.sort((a, b) => b.earnings_teleton - a.earnings_teleton);
}

export async function loadCreatorProfiles(limit = 20): Promise<CreatorProfile[]> {
  const profiles: CreatorProfile[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(CREATOR_PROFILES_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.user_id) {
          profiles.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return profiles.sort((a, b) => b.followers - a.followers);
}

export async function getCreatorProfile(userId: string): Promise<CreatorProfile | null> {
  const profiles = await loadCreatorProfiles(100);
  return profiles.find(p => p.user_id === userId) || null;
}

export async function createReferralCode(userId: string): Promise<string> {
  const existing = await getCreatorProfile(userId);
  if (existing?.referral_code) return existing.referral_code;
  
  const code = makeReferralCode(userId);
  
  const profile: CreatorProfile = existing || {
    user_id: userId,
    bio: "",
    links: [],
    rating: 0,
    total_sales: 0,
    followers: 0,
    referral_code: code,
    is_partner: false,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  
  if (!existing) {
    profile.referral_code = code;
    await appendCreatorProfile(profile);
  }
  
  return code;
}

export async function registerReferral(
  code: string,
  newUserId: string
): Promise<{ success: boolean; reward?: number; reason?: string }> {
  const profiles = await loadCreatorProfiles(100);
  const owner = profiles.find(p => p.referral_code === code);
  
  if (!owner) {
    return { success: false, reason: "invalid_code" };
  }
  
  if (owner.user_id === newUserId) {
    return { success: false, reason: "self_referral" };
  }
  
  const referrals = await loadReferrals();
  const alreadyReferred = referrals.some(
    r => r.invited_user_id === newUserId || r.owner_user_id === newUserId
  );
  
  if (alreadyReferred) {
    return { success: false, reason: "already_referred" };
  }
  
  const reward = 50;
  const referral: Referral = {
    referral_id: makeId("ref"),
    code,
    owner_user_id: owner.user_id,
    invited_user_id: newUserId,
    reward_teleton: reward,
    lifetime_value: 0,
    status: "active",
    created_at: Date.now(),
    activated_at: Date.now(),
  };
  
  await appendReferral(referral);
  
  try {
    const { purchaseTeleton } = await import("./wallet.js");
    await purchaseTeleton(owner.user_id, reward, "referral_bonus");
    await purchaseTeleton(newUserId, reward, "referral_bonus");
  } catch (e) {
    console.error("[referral] wallet bonus failed", e);
  }
  
  return { success: true, reward };
}

export async function getReferralStats(userId: string): Promise<{
  total_referrals: number;
  active_referrals: number;
  total_earnings: number;
  lifetime_value: number;
}> {
  const referrals = await loadReferrals(userId);
  const active = referrals.filter(r => r.status === "active");
  const total_earnings = active.reduce((s, r) => s + r.reward_teleton, 0);
  const lifetime_value = referrals.reduce((s, r) => s + r.lifetime_value, 0);
  
  return {
    total_referrals: referrals.length,
    active_referrals: active.length,
    total_earnings,
    lifetime_value,
  };
}

export async function createPartner(
  userId: string,
  commissionRate = 0.1
): Promise<Partner> {
  const partner: Partner = {
    partner_id: makeId("prt"),
    owner_user_id: userId,
    commission_rate: commissionRate,
    earnings_teleton: 0,
    total_payouts: 0,
    status: "active",
    created_at: Date.now(),
  };
  
  await appendPartner(partner);
  
  const profile = await getCreatorProfile(userId);
  if (profile) {
    profile.is_partner = true;
    profile.updated_at = Date.now();
    await appendCreatorProfile(profile);
  }
  
  return partner;
}

export async function addPartnerEarnings(
  partnerId: string,
  amount: number
): Promise<boolean> {
  const partners = await loadPartners();
  const partner = partners.find(p => p.partner_id === partnerId);
  if (!partner || partner.status !== "active") return false;
  
  const commission = amount * partner.commission_rate;
  partner.earnings_teleton += commission;
  await appendPartner(partner);
  
  try {
    const { purchaseTeleton } = await import("./wallet.js");
    await purchaseTeleton(partner.owner_user_id, commission, "partner_commission");
  } catch (e) {
    console.error("[partner] commission failed", e);
  }
  
  return true;
}

export async function updateCreatorProfile(
  userId: string,
  updates: Partial<CreatorProfile>
): Promise<CreatorProfile | null> {
  const profile = await getCreatorProfile(userId);
  if (!profile) return null;
  
  const updated = { ...profile, ...updates, updated_at: Date.now() };
  await appendCreatorProfile(updated);
  return updated;
}

export async function getLeaderboard(
  type?: "creator" | "seller" | "affiliate",
  limit = 10
): Promise<CreatorProfile[]> {
  const profiles = await loadCreatorProfiles(100);
  let filtered = profiles;
  
  if (type === "creator") {
    filtered = profiles.filter(p => p.is_partner);
  } else if (type === "seller") {
    filtered = profiles.filter(p => p.total_sales > 0);
  } else if (type === "affiliate") {
    const referrals = await loadReferrals();
    const affiliateIds = [...new Set(referrals.map(r => r.owner_user_id))];
    filtered = profiles.filter(p => affiliateIds.includes(p.user_id));
  }
  
  return filtered.slice(0, limit);
}

export function formatReferralStats(stats: {
  total_referrals: number;
  active_referrals: number;
  total_earnings: number;
  lifetime_value: number;
}): string {
  return [
    "🎯 Referral Stats:",
    `Total referrals: ${stats.total_referrals}`,
    `Active: ${stats.active_referrals}`,
    `Earnings: ${stats.total_earnings} TN`,
    `Lifetime value: ${stats.lifetime_value} TN`,
  ].join("\n");
}

export function formatCreatorProfile(profile: CreatorProfile): string {
  const lines = [
    `🎨 Creator Profile: ${profile.user_id}`,
    `Referral code: ${profile.referral_code}`,
    `Rating: ${"⭐".repeat(Math.round(profile.rating))}${"☆".repeat(5 - Math.round(profile.rating))}`,
    `Total sales: ${profile.total_sales}`,
    `Followers: ${profile.followers}`,
    `Partner: ${profile.is_partner ? "✅" : "❌"}`,
  ];
  
  if (profile.bio) lines.push(`\nBio: ${profile.bio}`);
  if (profile.links.length > 0) lines.push(`Links: ${profile.links.join(", ")}`);
  
  return lines.join("\n");
}

export function formatLeaderboard(profiles: CreatorProfile[]): string {
  if (profiles.length === 0) return "No entries yet";
  
  const lines = ["🏆 Leaderboard:\n"];
  profiles.forEach((p, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
    lines.push(`${medal} ${p.user_id} - ${p.followers} followers, ${p.total_sales} sales`);
  });
  
  return lines.join("\n");
}

export function generateAffiliateLink(
  listingId: string,
  referralCode: string
): string {
  return `telega.app/product/${listingId}?ref=${referralCode}`;
}

export async function trackReferralConversion(
  referralCode: string,
  amount: number
): Promise<void> {
  const referrals = await loadReferrals();
  const referral = referrals.find(r => r.code === referralCode && r.status === "active");
  
  if (referral) {
    referral.lifetime_value += amount;
    await appendReferral(referral);
  }
}
