import fs from "fs/promises";
import path from "path";

const USERS_DIR = path.join(process.cwd(), "data", "creator-bridge");
const USERS_FILE = path.join(USERS_DIR, "users.jsonl");

export type UserRole = "owner" | "creator" | "public";
export type UserPlan = "free" | "pro" | "creator";

export interface UserProfile {
  user_id: string;
  role: UserRole;
  plan: UserPlan;
  limits: {
    maxActiveJobs: number;
    maxPendingJobs: number;
    maxProviders: number;
    allowMultiAgent: boolean;
    allowTools: boolean;
    allowPatchPlan: boolean;
    allowPatchApply: boolean;
    dailyRequests: number;
  };
  usage: {
    activeJobs: number;
    pendingJobs: number;
    dailyRequests: number;
    lastReset: number;
  };
  created_at: number;
  updated_at: number;
}

export const PLAN_LIMITS: Record<UserPlan, UserProfile["limits"]> = {
  free: {
    maxActiveJobs: 2,
    maxPendingJobs: 5,
    maxProviders: 2,
    allowMultiAgent: false,
    allowTools: false,
    allowPatchPlan: false,
    allowPatchApply: false,
    dailyRequests: 50,
  },
  pro: {
    maxActiveJobs: 5,
    maxPendingJobs: 10,
    maxProviders: 5,
    allowMultiAgent: true,
    allowTools: true,
    allowPatchPlan: true,
    allowPatchApply: false,
    dailyRequests: 200,
  },
  creator: {
    maxActiveJobs: 10,
    maxPendingJobs: 20,
    maxProviders: 10,
    allowMultiAgent: true,
    allowTools: true,
    allowPatchPlan: true,
    allowPatchApply: true,
    dailyRequests: 1000,
  },
};

export const ROLE_PROVIDERS: Record<UserPlan, string[]> = {
  free: ["qwen_web", "chatgpt_web"],
  pro: ["qwen_web", "chatgpt_web", "deepseek_web", "perplexity_web", "claude_web"],
  creator: [
    "qwen_web", "chatgpt_web", "deepseek_web", "grok_web", "kimi_web",
    "perplexity_web", "claude_web", "gemini_web", "poe_web"
  ],
};

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(USERS_DIR, { recursive: true });
  } catch {}
}

async function appendUser(user: UserProfile): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(user) + "\n";
    await fs.appendFile(USERS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[users] write failed", e);
  }
}

async function loadUsers(): Promise<UserProfile[]> {
  const users: UserProfile[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(USERS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.user_id) {
          users.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return users;
}

export async function getOrCreateUser(userId: string, role: UserRole = "public"): Promise<UserProfile> {
  const users = await loadUsers();
  let user = users.find(u => u.user_id === userId);
  
  if (!user) {
    const plan: UserPlan = role === "owner" ? "creator" : role === "creator" ? "creator" : "free";
    user = {
      user_id: userId,
      role,
      plan,
      limits: { ...PLAN_LIMITS[plan] },
      usage: {
        activeJobs: 0,
        pendingJobs: 0,
        dailyRequests: 0,
        lastReset: Date.now(),
      },
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    await appendUser(user);
  }
  
  return user;
}

export function checkUserLimits(user: UserProfile): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  if (now - user.usage.lastReset > dayMs) {
    user.usage.dailyRequests = 0;
    user.usage.lastReset = now;
  }
  
  if (user.usage.dailyRequests >= user.limits.dailyRequests) {
    return { allowed: false, reason: "daily_limit_reached" };
  }
  
  if (user.usage.activeJobs >= user.limits.maxActiveJobs) {
    return { allowed: false, reason: "active_jobs_limit" };
  }
  
  if (user.usage.pendingJobs >= user.limits.maxPendingJobs) {
    return { allowed: false, reason: "pending_jobs_limit" };
  }
  
  return { allowed: true };
}

export function canUseProvider(user: UserProfile, provider: string): boolean {
  const allowed = ROLE_PROVIDERS[user.plan];
  return allowed.includes(provider);
}

export function canUseFeature(user: UserProfile, feature: string): boolean {
  switch (feature) {
    case "multi_agent":
      return user.limits.allowMultiAgent;
    case "tools":
      return user.limits.allowTools;
    case "patch_plan":
      return user.limits.allowPatchPlan;
    case "patch_apply":
      return user.limits.allowPatchApply;
    default:
      return false;
  }
}

export function incrementUsage(userId: string, activeJob = false): void {
  loadUsers().then(users => {
    const user = users.find(u => u.user_id === userId);
    if (user) {
      if (activeJob) {
        user.usage.activeJobs++;
      } else {
        user.usage.dailyRequests++;
      }
      user.updated_at = Date.now();
      appendUser(user);
    }
  });
}

export function decrementActiveJobs(userId: string): void {
  loadUsers().then(users => {
    const user = users.find(u => u.user_id === userId);
    if (user && user.usage.activeJobs > 0) {
      user.usage.activeJobs--;
      user.updated_at = Date.now();
      appendUser(user);
    }
  });
}

export function formatUserProfile(user: UserProfile): string {
  const lines = [
    `👤 User: ${user.user_id}`,
    `Role: ${user.role}`,
    `Plan: ${user.plan}`,
    `\n📊 Usage:`,
    `  Active jobs: ${user.usage.activeJobs}/${user.limits.maxActiveJobs}`,
    `  Pending jobs: ${user.usage.pendingJobs}/${user.limits.maxPendingJobs}`,
    `  Daily requests: ${user.usage.dailyRequests}/${user.limits.dailyRequests}`,
    `\n⚡ Features:`,
    `  Multi-agent: ${user.limits.allowMultiAgent ? "✅" : "❌"}`,
    `  Tools: ${user.limits.allowTools ? "✅" : "❌"}`,
    `  Patch plan: ${user.limits.allowPatchPlan ? "✅" : "❌"}`,
    `  Patch apply: ${user.limits.allowPatchApply ? "✅" : "❌"}`,
    `\n🌐 Providers: ${ROLE_PROVIDERS[user.plan].join(", ")}`,
  ];
  
  return lines.join("\n");
}

export function formatPlanInfo(plan: UserPlan): string {
  const limits = PLAN_LIMITS[plan];
  const providers = ROLE_PROVIDERS[plan];
  
  return `📦 Plan: ${plan.toUpperCase()}
  
Active jobs: ${limits.maxActiveJobs}
Pending jobs: ${limits.maxPendingJobs}
Daily requests: ${limits.dailyRequests}

Multi-agent: ${limits.allowMultiAgent ? "✅" : "❌"}
Tools: ${limits.allowTools ? "✅" : "❌"}
Patch plan: ${limits.allowPatchPlan ? "✅" : "❌"}
Patch apply: ${limits.allowPatchApply ? "✅" : "❌"}

Providers: ${providers.join(", ")}`;
}