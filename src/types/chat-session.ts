export type RuntimeRole = "creator" | "user";

export type ProviderKind =
  | "chatgpt_web"
  | "qwen_web"
  | "deepseek_web"
  | "openai_api"
  | "qwen_api"
  | "deepseek_api";

export type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  provider: ProviderKind;
  contextId: string;
  isActive: boolean;
  pageId?: string | null;
  bridgeEnabled?: boolean;
  lastAssistantText?: string | null;
  stuckCounter?: number;
};

export type BotUiScreen =
  | "settings_root"
  | "settings_runtime"
  | "settings_features"
  | "settings_provider"
  | "chats_root"
  | "chat_rename_waiting";

export type RuntimeSessionState = {
  role: RuntimeRole;
  currentChatId: string | null;
  chats: Record<string, ChatSession>;
  ui: {
    screen: BotUiScreen | "none";
    renameTargetChatId?: string | null;
  };
};

export type FeatureModuleId = "spyglass" | "t800" | "alice_bridge" | "voice" | "images" | "skills" | "mcp";
export type FeatureStatus = "planned" | "placeholder" | "active" | "disabled";

export type ProviderProfile = {
  id: string;
  provider: ProviderKind;
  title: string;
  mode: "web" | "api";
  browserProfilePath?: string | null;
  apiCredentialRef?: string | null;
  defaultModel?: string | null;
  enabled: boolean;
  priority: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  visibility: "creator" | "internal" | "user";
};

export type ProviderProfileRegistry = {
  profiles: Record<string, ProviderProfile>;
};