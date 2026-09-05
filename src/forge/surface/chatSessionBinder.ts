import { ChatMessage, ChatThread, ChatRole, ChatAttachment } from "./chatTypes";
import { SessionRegistry, touchSession } from "./sessionSurface";

const threads = new Map<string, ChatThread>();

let counter = 0;
function genId(): string {
  counter++;
  return `msg_${Date.now()}_${counter}`;
}

export function bindChatToSession(sessionId: string): ChatThread {
  let thread = threads.get(sessionId);
  if (!thread) {
    thread = { sessionId, messages: [], messageCount: 0, createdAt: Date.now(), updatedAt: Date.now() };
    threads.set(sessionId, thread);
  }
  return thread;
}

export function appendMessage(
  sessionId: string,
  role: ChatRole,
  content: string,
  attachments: ChatAttachment[],
  provider?: string,
  missionId?: string,
  evidenceRefs?: string[]
): ChatMessage {
  const thread = bindChatToSession(sessionId);
  const message: ChatMessage = {
    messageId: genId(),
    sessionId,
    role,
    content,
    attachments: attachments || [],
    provider,
    missionId,
    evidenceRefs: evidenceRefs || [],
    createdAt: Date.now(),
  };
  thread.messages.push(message);
  thread.messageCount = thread.messages.length;
  thread.updatedAt = Date.now();

  // Touch session
  touchSession(sessionId);

  return message;
}

export function getThread(sessionId: string): ChatThread | null {
  return threads.get(sessionId) || null;
}

export function resetThread(sessionId: string): void {
  threads.delete(sessionId);
}
