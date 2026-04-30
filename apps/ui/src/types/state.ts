
export type AppState = 'AppBoot' | 'AppOffline' | 'Ready';

// Chat States
export type ChatState = 
  | 'ChatIdle'
  | 'ChatLoading'
  | 'ChatStreaming'
  | 'ChatStopped'
  | 'ChatSuccess'
  | 'ChatError';

// Translate States
export type TranslateState =
  | 'TranslateIdle'
  | 'TranslateLoading'
  | 'TranslateSuccess'
  | 'TranslateError';

// JSON States
export type JsonState =
  | 'JSONIdle'
  | 'JSONLoading'
  | 'JSONValid'
  | 'JSONInvalid'
  | 'JSONRepairing';

// Voice States
export type VoiceState =
  | 'VoiceIdle'
  | 'VoiceRecording'
  | 'VoiceProcessing'
  | 'VoiceSpeaking'
  | 'VoiceError';
