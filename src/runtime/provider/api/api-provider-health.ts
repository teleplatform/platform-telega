import type { ApiProviderId, ApiProviderStatus } from "./api-provider.types.js";
import { ApiProviderRegistry } from "./api-provider-registry.js";

export class ApiProviderHealth {
  private registry: ApiProviderRegistry;
  private statusCache = new Map<ApiProviderId, ApiProviderStatus>();

  constructor(registry: ApiProviderRegistry) {
    this.registry = registry;
  }

  check(id: ApiProviderId): ApiProviderStatus {
    const config = this.registry.get(id);
    if (!config) {
      return { provider_id: id, enabled: false, has_credentials: false, health: "unknown" };
    }

    const hasCredentials = !!process.env[config.api_key_env];
    const health = hasCredentials ? "healthy" : "missing_credentials";

    const status: ApiProviderStatus = {
      provider_id: id,
      enabled: true,
      has_credentials: hasCredentials,
      health,
      last_checked_at: new Date().toISOString(),
    };

    this.statusCache.set(id, status);
    return status;
  }

  checkAll(): ApiProviderStatus[] {
    return this.registry.list().map((p) => this.check(p.id));
  }

  getStatus(id: ApiProviderId): ApiProviderStatus | undefined {
    return this.statusCache.get(id);
  }

  getAllStatuses(): ApiProviderStatus[] {
    return [...this.statusCache.values()];
  }
}
