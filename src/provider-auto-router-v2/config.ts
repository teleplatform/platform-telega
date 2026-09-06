export interface AutoRouterV2Config {
  enabled: boolean;
  allowExperimental: boolean;
  preferFree: boolean;
  maxRecentFailures: number;
}

const config: AutoRouterV2Config = {
  enabled: process.env.AUTO_ROUTER_V2_ENABLED !== "false",
  allowExperimental: process.env.AUTO_ROUTER_ALLOW_EXPERIMENTAL === "true",
  preferFree: process.env.AUTO_ROUTER_PREFER_FREE === "true",
  maxRecentFailures: Number(process.env.AUTO_ROUTER_MAX_RECENT_FAILURES) || 3,
};

let runtimeOverrides: Partial<AutoRouterV2Config> = {};

export function getAutoRouterConfig(): AutoRouterV2Config {
  return { ...config, ...runtimeOverrides };
}

export function setAutoRouterConfig(overrides: Partial<AutoRouterV2Config>): void {
  runtimeOverrides = { ...runtimeOverrides, ...overrides };
}

export function formatAutoRouterConfig(): string {
  const c = getAutoRouterConfig();
  const lines = [
    "🤖 *Auto Router v2*",
    "",
    `Enabled: ${c.enabled ? "✅" : "❌"}`,
    `Allow experimental: ${c.allowExperimental ? "✅" : "❌"}`,
    `Prefer free: ${c.preferFree ? "✅" : "❌"}`,
    `Max recent failures: ${c.maxRecentFailures}`,
  ];
  return lines.join("\n");
}
