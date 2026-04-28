export type TelegramRuntimeStatus = {
  forcedProvider?: string;
  effectiveProvider?: string;
  bridge_enabled: boolean;
  creatorMode: boolean;
  voice_enabled: boolean;
  lastFallback: boolean;
  lastError?: string;
  lastWhy?: string;
};
