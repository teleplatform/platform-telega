import type { UnifiedTransport } from "../../runtime-channel-contracts/src/inbound.js";

export interface ChannelAdapter {
  transport: UnifiedTransport;
  normalizeInbound(raw: unknown): any;
  buildOutbound(message: any): unknown;
  isAvailable(): boolean;
}

export interface AdapterRegistry {
  registerAdapter(adapter: ChannelAdapter): void;
  getAdapter(transport: UnifiedTransport): ChannelAdapter | undefined;
  listAdapters(): ChannelAdapter[];
}

export function createAdapterRegistry(): AdapterRegistry {
  const adapters = new Map<UnifiedTransport, ChannelAdapter>();
  return {
    registerAdapter(adapter) {
      if (adapters.has(adapter.transport)) {
        throw new Error(`Adapter for ${adapter.transport} already registered`);
      }
      adapters.set(adapter.transport, adapter);
    },
    getAdapter(transport) {
      return adapters.get(transport);
    },
    listAdapters() {
      return Array.from(adapters.values());
    },
  };
}
