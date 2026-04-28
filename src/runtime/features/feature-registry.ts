export type FeatureCategory =
  | "voice"
  | "media"
  | "agent"
  | "execution"
  | "bridge"
  | "intake";

export type FeatureStatus = "active" | "planned" | "placeholder" | "disabled";
export type FeatureVisibility = "creator" | "user" | "internal";

export type FeatureModuleEntry = {
  id: string;
  status: FeatureStatus;
  title: string;
  category: FeatureCategory;
  description: string;
  visibility: FeatureVisibility;
};

export const FEATURE_REGISTRY: Record<string, FeatureModuleEntry> = {
  alice_bridge: {
    id: "alice_bridge",
    status: "planned",
    title: "Alice Bridge",
    category: "voice",
    description: "Voice/dialog ingress surface",
    visibility: "creator",
  },
  voice: {
    id: "voice",
    status: "planned",
    title: "Voice",
    category: "voice",
    description: "STT / TTS / voice runtime foundation",
    visibility: "creator",
  },
  images: {
    id: "images",
    status: "planned",
    title: "Images",
    category: "media",
    description: "Image/story generation runtime",
    visibility: "creator",
  },
  spyglass: {
    id: "spyglass",
    status: "placeholder",
    title: "Spyglass",
    category: "agent",
    description: "Research / monitoring / context collection",
    visibility: "creator",
  },
  t800: {
    id: "t800",
    status: "placeholder",
    title: "T-800",
    category: "agent",
    description: "Execution / controlled action layer",
    visibility: "creator",
  },
  sigma_forge_ide_bridge: {
    id: "sigma_forge_ide_bridge",
    status: "planned",
    title: "Sigma Forge IDE",
    category: "execution",
    description: "IDE / patch / engineering bridge",
    visibility: "creator",
  },
  kilo_code: {
    id: "kilo_code",
    status: "planned",
    title: "Kilo Code",
    category: "execution",
    description: "MCP code execution / file ops / sandbox runtime",
    visibility: "creator",
  },
  telegpt_intake_surface: {
    id: "telegpt_intake_surface",
    status: "active",
    title: "TeleGPT Intake",
    category: "intake",
    description: "Inbound capture surface via @yt_ForgeTranscriptbot",
    visibility: "internal",
  },
  mcp: {
    id: "mcp",
    status: "planned",
    title: "MCP",
    category: "execution",
    description: "Model Context Protocol bridge",
    visibility: "creator",
  },
};

export function getFeatureRegistry(): Record<string, FeatureModuleEntry> {
  return FEATURE_REGISTRY;
}

export function getFeaturesByCategory(category: FeatureCategory): FeatureModuleEntry[] {
  return Object.values(FEATURE_REGISTRY).filter(f => f.category === category);
}

export function getFeaturesByVisibility(visibility: FeatureVisibility): FeatureModuleEntry[] {
  return Object.values(FEATURE_REGISTRY).filter(f => f.visibility === visibility);
}
