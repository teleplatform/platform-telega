import fs from "fs";
import path from "path";

export type CreatorWebProvider = {
  id: string;
  kind: "creator-web-automation";
  display_name: string;
  source_url: string;
  maker_only: boolean;
  enabled: boolean;
  policy_id: string;
};

type ProviderConfig = {
  providers: CreatorWebProvider[];
};

let cached: ProviderConfig | null = null;

function configPath(): string {
  return path.join(process.cwd(), "config", "providers.creator-web.json");
}

function loadConfig(): ProviderConfig {
  if (cached) return cached;
  const raw = fs.readFileSync(configPath(), "utf8");
  const json = JSON.parse(raw) as ProviderConfig;
  cached = json;
  return json;
}

export function listCreatorWebProviders(): CreatorWebProvider[] {
  const providers = (loadConfig() as any)?.providers ?? [];
  return providers.map((p: any) => ({
    id: String(p.id),
    kind: "creator-web-automation",
    display_name: String(p.display_name),
    source_url: String(p.source_url),
    maker_only: Boolean(p.maker_only),
    enabled: Boolean(p.enabled),
    policy_id: String(p.policy_id),
  }));
}

export function getCreatorWebProvider(provider_id: string): CreatorWebProvider | null {
  const found = listCreatorWebProviders().find((p) => p.id === provider_id);
  return found ?? null;
}
