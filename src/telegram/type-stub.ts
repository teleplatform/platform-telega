// Type stub for telegraph module loading - bypasses compile-time type checking
// These types are used only at compile time, runtime loads actual module

declare module "../telegram/bot.js" {
  export async function startTelegramBotIfEnabled(): Promise<void>;
}

declare module "../telegram/voiceTurnSmoothing.js" {
  export function smoothVoiceTurn(state: any): any;
  export function getVoiceMode(voiceState: any): string | undefined;
  export function getVoiceStyle(voiceState: any): string | undefined;
}

declare module "../telegram/voiceFailureRecovery.js" {
  export function handleVoiceFailure(error: any, context: any): any;
}

declare module "../telegram/artifactExecutionBridge.js" {
  export async function createArtifactExecutionBridge(config: any): Promise<any>;
}