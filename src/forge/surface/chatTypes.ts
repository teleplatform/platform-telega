export type ChatRole = "user" | "assistant" | "system";

export interface ChatAttachment {
  type: "file" | "image" | "voice";
  name: string;
  url: string;
  size: number;
}

export interface ChatMessage {
  messageId: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  attachments: ChatAttachment[];
  provider?: string;
  missionId?: string;
  evidenceRefs: string[];
  createdAt: number;
}

export interface ChatThread {
  sessionId: string;
  messages: ChatMessage[];
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChatComposerState {
  text: string;
  attachments: ChatAttachment[];
  mode: "text" | "voice" | "forged";
}

export interface ChatProviderBadge {
  providerId: string;
  providerName: string;
  mode: string;
}

export interface ChatMissionBadge {
  missionId: string;
  missionTitle: string;
}
