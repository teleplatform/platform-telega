export * from "./chat-surface.types.js";

export * from "./voice-input.js";
export * from "./read-aloud.js";
export * from "./file-ingest.js";
export * from "./auto-file-fallback.js";
export * from "./chat-actions.js";

export * from "./chat-surface-router.js";
export * from "./chat-surface-policy.js";

export * from "./smoke.js";

export const CHAT_SURFACE_VERSION = "v1";

export const CHAT_SURFACE_CAPABILITIES_LIST = [
  "voice_input",
  "read_aloud",
  "voice_output",
  "file_upload",
  "file_reading",
  "auto_file_fallback",
  "image_generation",
  "chat_actions",
] as const;

export type ChatSurfaceCapability = typeof CHAT_SURFACE_CAPABILITIES_LIST[number];

export interface ChatSurfaceConfig {
  bot: any;
  imageGenerationFn?: (prompt: string) => Promise<{ ok: boolean; fileId?: string; error?: string }>;
  transcriptionFn?: (filePath: string) => Promise<{ text: string; error?: string }>;
}

export function initChatSurface(config: ChatSurfaceConfig): void {
  const { initChatSurfaceRouter } = require("./chat-surface-router.js");
  initChatSurfaceRouter({
    bot: config.bot,
    imageGenerationFn: config.imageGenerationFn,
    transcriptionFn: config.transcriptionFn,
  });
}