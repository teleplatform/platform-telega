import { PublicCapability, PublicHiddenFeature, PublicSurfaceState } from "./publicTypes";

const DEFAULT_CAPABILITIES: PublicCapability[] = [
  "chat.send", "chat.copy", "chat.new",
  "voice.input", "voice.output",
  "file.upload.safe", "translate.use", "history.view",
];

const DEFAULT_HIDDEN: PublicHiddenFeature[] = [
  "provider.debug", "evidence.raw", "policy.editor",
  "override.controls", "repair.controls", "capsule.internals",
];

export const PublicRegistry = {
  getState(sessionId?: string): PublicSurfaceState {
    return {
      mode: "public",
      capabilities: [...DEFAULT_CAPABILITIES],
      hidden: [...DEFAULT_HIDDEN],
      sessionId: sessionId || null,
    };
  },

  getCapabilities(): PublicCapability[] {
    return [...DEFAULT_CAPABILITIES];
  },

  getHidden(): PublicHiddenFeature[] {
    return [...DEFAULT_HIDDEN];
  },

  hasCapability(capability: string): boolean {
    return DEFAULT_CAPABILITIES.includes(capability as PublicCapability);
  },
};
