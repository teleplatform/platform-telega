export const GOVERNOR_CONFIG = {
  user: {
    maxActiveJobs: 3,
    maxPendingJobs: 10,
  },
  global: {
    maxActiveJobs: 10,
    maxPendingJobs: 50,
    maxConcurrentJobs: 2,
  },
  provider: {
    maxConcurrency: 1,
    cooldownMinutes: {
      RATE_LIMIT: 10,
      OVERLOAD: 10,
      AUTH_REQUIRED: 999999,
      EMPTY_OUTPUT: 2,
      TIMEOUT: 2,
    },
  },
  multiAgent: {
    maxSteps: 5,
    maxAgents: 3,
  },
};

export type PriorityClass = "owner_high" | "creator_normal" | "public_low";

export interface ProviderLoad {
  provider: string;
  activeCount: number;
  queuedCount: number;
  cooldownUntil: number | null;
  avgLatencyMs: number;
  lastErrorCode: string | null;
  lastUsed: number;
}

export interface GovernorState {
  userActiveJobs: Map<string, number>;
  userPendingJobs: Map<string, number>;
  globalActiveJobs: number;
  globalPendingJobs: number;
  providerLoads: Map<string, ProviderLoad>;
}

const state: GovernorState = {
  userActiveJobs: new Map(),
  userPendingJobs: new Map(),
  globalActiveJobs: 0,
  globalPendingJobs: 0,
  providerLoads: new Map(),
};

export function getPriorityClass(userId: string, role: string): PriorityClass {
  if (role === "owner") return "owner_high";
  if (role === "creator" || role === "partner") return "creator_normal";
  return "public_low";
}

export function checkUserJobLimit(userId: string): { allowed: boolean; reason?: string; position?: number } {
  const active = state.userActiveJobs.get(userId) || 0;
  const pending = state.userPendingJobs.get(userId) || 0;
  const total = active + pending;
  
  if (active >= GOVERNOR_CONFIG.user.maxActiveJobs) {
    return { 
      allowed: false, 
      reason: `user_active_limit:${active}/${GOVERNOR_CONFIG.user.maxActiveJobs}`,
      position: pending + 1 
    };
  }
  
  if (total >= GOVERNOR_CONFIG.user.maxPendingJobs) {
    return { 
      allowed: false, 
      reason: `user_pending_limit:${total}/${GOVERNOR_CONFIG.user.maxPendingJobs}`,
      position: undefined 
    };
  }
  
  return { allowed: true };
}

export function checkGlobalLimit(): { allowed: boolean; reason?: string } {
  if (state.globalActiveJobs >= GOVERNOR_CONFIG.global.maxActiveJobs) {
    return { 
      allowed: false, 
      reason: `global_active_limit:${state.globalActiveJobs}/${GOVERNOR_CONFIG.global.maxActiveJobs}` 
    };
  }
  
  if (state.globalPendingJobs >= GOVERNOR_CONFIG.global.maxPendingJobs) {
    return { 
      allowed: false, 
      reason: `global_pending_limit:${state.globalPendingJobs}/${GOVERNOR_CONFIG.global.maxPendingJobs}` 
    };
  }
  
  return { allowed: true };
}

export function checkProviderLoad(provider: string): { allowed: boolean; reason?: string } {
  const load = state.providerLoads.get(provider);
  
  if (!load) {
    return { allowed: true };
  }
  
  if (load.activeCount >= GOVERNOR_CONFIG.provider.maxConcurrency) {
    return { 
      allowed: false, 
      reason: `provider_busy:${provider}:${load.activeCount}/${GOVERNOR_CONFIG.provider.maxConcurrency}` 
    };
  }
  
  if (load.cooldownUntil && Date.now() < load.cooldownUntil) {
    const remaining = Math.round((load.cooldownUntil - Date.now()) / 60000);
    return { 
      allowed: false, 
      reason: `provider_cooldown:${provider}:${remaining}m` 
    };
  }
  
  return { allowed: true };
}

export function acquireProviderSlot(provider: string): void {
  let load = state.providerLoads.get(provider);
  if (!load) {
    load = {
      provider,
      activeCount: 0,
      queuedCount: 0,
      cooldownUntil: null,
      avgLatencyMs: 0,
      lastErrorCode: null,
      lastUsed: Date.now(),
    };
    state.providerLoads.set(provider, load);
  }
  load.activeCount++;
  load.lastUsed = Date.now();
}

export function releaseProviderSlot(provider: string, latencyMs?: number, errorCode?: string | null): void {
  const load = state.providerLoads.get(provider);
  if (!load) return;
  
  load.activeCount = Math.max(0, load.activeCount - 1);
  
  if (errorCode) {
    load.lastErrorCode = errorCode;
    const cooldownMinutes = GOVERNOR_CONFIG.provider.cooldownMinutes[errorCode as keyof typeof GOVERNOR_CONFIG.provider.cooldownMinutes];
    if (cooldownMinutes && cooldownMinutes < 999999) {
      load.cooldownUntil = Date.now() + cooldownMinutes * 60000;
    }
  }
  
  if (latencyMs && latencyMs > 0) {
    const count = load.activeCount + 1;
    load.avgLatencyMs = Math.round((load.avgLatencyMs * (count - 1) + latencyMs) / count);
  }
}

export function incrementUserJob(userId: string, isActive: boolean): void {
  if (isActive) {
    state.userActiveJobs.set(userId, (state.userActiveJobs.get(userId) || 0) + 1);
    state.globalActiveJobs++;
  } else {
    state.userPendingJobs.set(userId, (state.userPendingJobs.get(userId) || 0) + 1);
    state.globalPendingJobs++;
  }
}

export function decrementUserJob(userId: string, wasActive: boolean): void {
  if (wasActive) {
    const current = state.userActiveJobs.get(userId) || 0;
    state.userActiveJobs.set(userId, Math.max(0, current - 1));
    state.globalActiveJobs = Math.max(0, state.globalActiveJobs - 1);
  } else {
    const current = state.userPendingJobs.get(userId) || 0;
    state.userPendingJobs.set(userId, Math.max(0, current - 1));
    state.globalPendingJobs = Math.max(0, state.globalPendingJobs - 1);
  }
}

export function incrementProviderQueue(provider: string): void {
  const load = state.providerLoads.get(provider) || {
    provider,
    activeCount: 0,
    queuedCount: 0,
    cooldownUntil: null,
    avgLatencyMs: 0,
    lastErrorCode: null,
    lastUsed: Date.now(),
  };
  load.queuedCount++;
  state.providerLoads.set(provider, load);
}

export function decrementProviderQueue(provider: string): void {
  const load = state.providerLoads.get(provider);
  if (load) {
    load.queuedCount = Math.max(0, load.queuedCount - 1);
  }
}

export function getGovernorState(): {
  global: { active: number; pending: number };
  userCounts: Array<{ userId: string; active: number; pending: number }>;
  providers: ProviderLoad[];
} {
  const userCounts = Array.from(state.userActiveJobs.entries()).map(([userId, active]) => ({
    userId,
    active,
    pending: state.userPendingJobs.get(userId) || 0,
  }));
  
  const providers = Array.from(state.providerLoads.values());
  
  return {
    global: {
      active: state.globalActiveJobs,
      pending: state.globalPendingJobs,
    },
    userCounts: userCounts.slice(0, 10),
    providers,
  };
}

export function formatGovernorState(): string {
  const s = getGovernorState();
  const lines = [
    "⚖️ Governor State",
    `\nGlobal: ${s.global.active} active, ${s.global.pending} pending`,
    `\nLimits: ${GOVERNOR_CONFIG.global.maxActiveJobs} max active, ${GOVERNOR_CONFIG.global.maxPendingJobs} max pending`,
  ];
  
  if (s.providers.length > 0) {
    lines.push("\n🖥 Provider Load:");
    for (const p of s.providers) {
      const cooldown = p.cooldownUntil && Date.now() < p.cooldownUntil 
        ? `❄️${Math.round((p.cooldownUntil - Date.now()) / 60000)}m` 
        : "";
      lines.push(`${p.provider}: ${p.activeCount} active, ${p.queuedCount} queued${cooldown} avg${p.avgLatencyMs}ms`);
    }
  }
  
  return lines.join("\n");
}