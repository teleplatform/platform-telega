import type { UnifiedTransport, UnifiedInboundEvent } from "../../runtime-channel-contracts/src/inbound.js";
import type { ChannelAdapter } from "../adapters/adapterRegistry.js";

export function createTelegramAdapter(): ChannelAdapter {
  return {
    transport: "telegram",
    normalizeInbound(raw: any): UnifiedInboundEvent {
      return {
        transport: "telegram",
        tele_user_id: String(raw.from?.id ?? raw.chat?.id ?? "unknown"),
        session_id: String(raw.chat?.id ?? "unknown"),
        text: raw.text ?? raw.caption ?? "",
        metadata: raw,
      };
    },
    buildOutbound(message: any): unknown {
      return { chat_id: message.chat_id ?? message.tele_user_id, text: message.text };
    },
    isAvailable(): boolean { return true; },
  };
}

export function createWebAdapter(): ChannelAdapter {
  return {
    transport: "web",
    normalizeInbound(raw: any): UnifiedInboundEvent {
      return {
        transport: "web",
        tele_user_id: String(raw.user_id ?? "unknown"),
        session_id: String(raw.session_id ?? "default"),
        text: raw.text ?? raw.message ?? "",
        metadata: raw,
      };
    },
    buildOutbound(message: any): unknown {
      return { user_id: message.tele_user_id, text: message.text };
    },
    isAvailable(): boolean { return true; },
  };
}

export function createMiniappAdapter(): ChannelAdapter {
  return {
    transport: "miniapp",
    normalizeInbound(raw: any): UnifiedInboundEvent {
      return {
        transport: "miniapp",
        tele_user_id: String(raw.initData?.user?.id ?? "unknown"),
        session_id: String(raw.session_id ?? "default"),
        text: raw.text ?? raw.message ?? "",
        metadata: raw,
      };
    },
    buildOutbound(message: any): unknown {
      return { user_id: message.tele_user_id, text: message.text };
    },
    isAvailable(): boolean { return true; },
  };
}

export function createTgmAdapter(): ChannelAdapter {
  return {
    transport: "tgm",
    normalizeInbound(raw: any): UnifiedInboundEvent {
      return {
        transport: "tgm",
        tele_user_id: String(raw.user_id ?? "unknown"),
        session_id: String(raw.session_id ?? "default"),
        text: raw.text ?? raw.message ?? "",
        metadata: raw,
      };
    },
    buildOutbound(message: any): unknown {
      return { user_id: message.tele_user_id, text: message.text };
    },
    isAvailable(): boolean { return true; },
  };
}

export function registerDefaultAdapters(registry: { registerAdapter: (a: ChannelAdapter) => void }): void {
  registry.registerAdapter(createTelegramAdapter());
  registry.registerAdapter(createWebAdapter());
  registry.registerAdapter(createMiniappAdapter());
  registry.registerAdapter(createTgmAdapter());
}
