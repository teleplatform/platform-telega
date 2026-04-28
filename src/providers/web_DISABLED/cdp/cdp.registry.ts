import type { WebProviderId, WebCDPProviderConfig, CDPBrowserConfig } from "./cdp.types.js";
import { PROVIDER_CONFIGS, DEFAULT_CDP_PORT } from "./cdp.types.js";

export interface RegistryEntry {
  provider: WebProviderId;
  config: WebCDPProviderConfig;
  browserConfig: CDPBrowserConfig;
  active: boolean;
  priority: number;
}

export class CDPProviderRegistry {
  private registry: Map<WebProviderId, RegistryEntry> = new Map();
  private defaultBrowserConfig: CDPBrowserConfig = {
    debugPort: DEFAULT_CDP_PORT,
    headless: false,
    timeoutMs: 60000,
  };

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const providers: WebProviderId[] = ["chatgpt_web", "qwen_web", "deepseek_web"];
    
    providers.forEach((provider, index) => {
      const adapterConfig = PROVIDER_CONFIGS[provider];
      
      this.registry.set(provider, {
        provider,
        config: {
          provider,
          debugUrl: `http://127.0.0.1:${DEFAULT_CDP_PORT}`,
          expectedHostnames: [adapterConfig.expectedHostname],
          sessionRequired: true,
          manualLoginOnly: true,
        },
        browserConfig: this.defaultBrowserConfig,
        active: index === 0,
        priority: index,
      });
    });
  }

  get(provider: WebProviderId): RegistryEntry | undefined {
    return this.registry.get(provider);
  }

  list(): RegistryEntry[] {
    return Array.from(this.registry.values()).sort((a, b) => a.priority - b.priority);
  }

  listActive(): RegistryEntry[] {
    return this.list().filter(entry => entry.active);
  }

  setActive(provider: WebProviderId, active: boolean): void {
    const entry = this.registry.get(provider);
    if (entry) {
      this.registry.set(provider, { ...entry, active });
    }
  }

  setPriority(provider: WebProviderId, priority: number): void {
    const entry = this.registry.get(provider);
    if (entry) {
      this.registry.set(provider, { ...entry, priority });
    }
  }

  updateBrowserConfig(provider: WebProviderId, config: Partial<CDPBrowserConfig>): void {
    const entry = this.registry.get(provider);
    if (entry) {
      this.registry.set(provider, {
        ...entry,
        browserConfig: { ...entry.browserConfig, ...config },
      });
    }
  }

  getProviderConfig(provider: WebProviderId): WebCDPProviderConfig | undefined {
    return this.registry.get(provider)?.config;
  }

  getFirstActive(): WebProviderId | null {
    const active = this.listActive();
    return active.length > 0 ? active[0].provider : null;
  }

  getNextActive(after: WebProviderId): WebProviderId | null {
    const active = this.listActive();
    const index = active.findIndex(a => a.provider === after);
    
    if (index >= 0 && index < active.length - 1) {
      return active[index + 1].provider;
    }
    return null;
  }
}

let registryInstance: CDPProviderRegistry | null = null;

export function getCDPProviderRegistry(): CDPProviderRegistry {
  if (!registryInstance) {
    registryInstance = new CDPProviderRegistry();
  }
  return registryInstance;
}

export function createCDPProviderRegistry(): CDPProviderRegistry {
  return new CDPProviderRegistry();
}