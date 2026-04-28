// Minimal type stubs for telegraph runtime modules
// Allows compilation to pass while preserving runtime loading

declare module "../telegram/bot" {
  export function startTelegramBotIfEnabled(): Promise<void>;
}

declare module "../telegram/bot.js" {
  export function startTelegramBotIfEnabled(): Promise<void>;
}

declare module "../telegram/voiceTurnSmoothing" {
  export function smoothVoiceTurn(state: unknown): unknown;
  export function getVoiceMode(state: unknown): string | undefined;
  export function getVoiceStyle(state: unknown): string | undefined;
}

declare module "../telegram/voiceTurnSmoothing.js" {
  export function smoothVoiceTurn(state: unknown): unknown;
  export function getVoiceMode(state: unknown): string | undefined;
  export function getVoiceStyle(state: unknown): string | undefined;
}

declare module "../telegram/voiceFailureRecovery" {
  export function handleVoiceFailure(error: unknown, context: unknown): unknown;
}

declare module "../telegram/voiceFailureRecovery.js" {
  export function handleVoiceFailure(error: unknown, context: unknown): unknown;
}

declare module "../telegram/artifactExecutionBridge" {
  export function createArtifactExecutionBridge(config: unknown): unknown;
}

declare module "../telegram/artifactExecutionBridge.js" {
  export function createArtifactExecutionBridge(config: unknown): unknown;
}