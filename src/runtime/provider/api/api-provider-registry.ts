import type { ApiProviderId, ApiProviderConfig } from "./api-provider.types.js";

const BUILTIN_API_PROVIDERS: ApiProviderConfig[] = [
  { provider_id: "openai:api", display_name: "OpenAI API", api_key_env: "OPENAI_API_KEY", endpoint: "https://api.openai.com/v1" },
  { provider_id: "qwen:api", display_name: "Qwen API", api_key_env: "QWEN_API_KEY", endpoint: "https://dashscope.aliyuncs.com/v1" },
  { provider_id: "deepseek:api", display_name: "DeepSeek API", api_key_env: "DEEPSEEK_API_KEY", endpoint: "https://api.deepseek.com/v1" },
];

export class ApiProviderRegistry {
  private providers = new Map<ApiProviderId, ApiProviderConfig>(BUILTIN_API_PROVIDERS.map((p) => [p.provider_id, p]));

  get(id: ApiProviderId): ApiProviderConfig | undefined {
    return this.providers.get(id);
  }

  getAll(): ApiProviderConfig[] {
    return [...this.providers.values()];
  }

  list(): { id: ApiProviderId; display_name: string }[] {
    return this.getAll().map((p) => ({ id: p.provider_id, display_name: p.display_name }));
  }
}
