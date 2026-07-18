export type ProviderTier = "stable" | "beta" | "experimental" | "disabled";

export interface TieredProvider {
  providerId: string;
  displayName: string;
  tier: ProviderTier;
  reason?: string;
}

const TIER_REGISTRY: TieredProvider[] = [
  { providerId: "openai_api", displayName: "OpenAI API", tier: "stable" },
  { providerId: "openai_web", displayName: "OpenAI Web", tier: "stable" },
  { providerId: "qwen_api", displayName: "Qwen API", tier: "stable" },
  { providerId: "qwen_web", displayName: "Qwen Web", tier: "stable" },
  { providerId: "deepseek_api", displayName: "DeepSeek API", tier: "stable" },
  { providerId: "deepseek_web", displayName: "DeepSeek Web", tier: "stable" },
  { providerId: "gemini_web", displayName: "Gemini Web", tier: "stable" },
  { providerId: "claude_web", displayName: "Claude Web", tier: "stable" },
  { providerId: "kimi_api", displayName: "Kimi API", tier: "experimental", reason: "K3 registered, pending smoke verification" },
  { providerId: "kimi_local_web_api", displayName: "Kimi Browser", tier: "stable" },
  { providerId: "glm_local_web_api", displayName: "GLM Browser", tier: "stable" },
  { providerId: "minimax", displayName: "MiniMax Agent", tier: "stable" },
  { providerId: "grok_web", displayName: "Grok Web", tier: "stable" },
  { providerId: "kimi_free_local", displayName: "Kimi Free Local", tier: "experimental", reason: "Uses unofficial local proxy. May be unstable or disappear." },
];

const TIER_ICONS: Record<ProviderTier, string> = {
  stable: "🟢",
  beta: "🟡",
  experimental: "🧪",
  disabled: "🔴",
};

export function getTier(providerId: string): ProviderTier {
  return TIER_REGISTRY.find(p => p.providerId === providerId)?.tier || "stable";
}

export function getTierIcon(providerId: string): string {
  const tier = getTier(providerId);
  return TIER_ICONS[tier] || "🟢";
}

export function getReason(providerId: string): string | undefined {
  return TIER_REGISTRY.find(p => p.providerId === providerId)?.reason;
}

export function getStableProviders(): string[] {
  return TIER_REGISTRY.filter(p => p.tier === "stable").map(p => p.providerId);
}

export function getExperimentalProviders(): string[] {
  return TIER_REGISTRY.filter(p => p.tier === "experimental").map(p => p.providerId);
}

export function formatTieredProviderList(): string {
  const lines: string[] = ["📡 *Provider Tiers*\n"];
  const tiers: ProviderTier[] = ["stable", "beta", "experimental", "disabled"];
  const labels: Record<ProviderTier, string> = { stable: "Stable", beta: "Beta", experimental: "Experimental", disabled: "Disabled" };

  for (const tier of tiers) {
    const providers = TIER_REGISTRY.filter(p => p.tier === tier);
    if (providers.length === 0) continue;
    lines.push(`*${TIER_ICONS[tier]} ${labels[tier]}*`);
    for (const p of providers) {
      lines.push(`  \`${p.providerId}\` — ${p.displayName}`);
      if (p.reason) lines.push(`    _${p.reason}_`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
