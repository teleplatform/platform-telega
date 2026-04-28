export type ForcedProvider =
  | "auto"
  | "ollama_local"
  | "openai_api"
  | "qwen_api"
  | "deepseek_api"
  | "openai_web"
  | "qwen_web"
  | "deepseek_web";

export type RuntimeSessionLike = {
  provider?: ForcedProvider;
  bridge_enabled?: boolean;
  creatorMode?: boolean;
};

export function isWebProvider(provider: string): boolean {
  return (
    provider === "openai_web" ||
    provider === "qwen_web" ||
    provider === "deepseek_web"
  );
}

export function resolveForcedProviderFromSession(session: RuntimeSessionLike): {
  forcedProvider: ForcedProvider;
  bridgeEnabled: boolean;
  creatorMode: boolean;
} {
  return {
    forcedProvider: session.provider || "auto",
    bridgeEnabled: Boolean(session.bridge_enabled),
    creatorMode: Boolean(session.creatorMode),
  };
}
