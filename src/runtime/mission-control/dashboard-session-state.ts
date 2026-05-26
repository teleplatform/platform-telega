import { sendTelegramMissionControlMessage, editTelegramMissionControlMessage, loadTelegramSenderConfig } from './telegram-sender.js';
import type { TelegramSenderConfig } from './telegram-sender.js';

export interface DashboardSession {
  id: string;
  chatId: string;
  messageId: number | null;
  lastUpdate: number;
  intervalMs: number;
  active: boolean;
}

const sessions = new Map<string, DashboardSession>();

let sessionCounter = 0;

function generateSessionId(): string {
  return `ds_${Date.now()}_${String(++sessionCounter).padStart(4, '0')}`;
}

export function createDashboardSession(chatId: string, intervalMs = 30000): DashboardSession {
  const session: DashboardSession = {
    id: generateSessionId(),
    chatId,
    messageId: null,
    lastUpdate: 0,
    intervalMs,
    active: true
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): DashboardSession | undefined {
  return sessions.get(id);
}

export function listSessions(): DashboardSession[] {
  return [...sessions.values()];
}

export function stopSession(id: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;
  session.active = false;
  return true;
}

export function removeSession(id: string): boolean {
  return sessions.delete(id);
}

export async function sendDashboardMessage(
  sessionId: string,
  text: string,
  config?: TelegramSenderConfig
): Promise<{ ok: boolean; messageId: number | null; error?: string }> {
  const session = sessions.get(sessionId);
  if (!session) return { ok: false, messageId: null, error: 'session not found' };

  const cfg = config ?? loadTelegramSenderConfig();
  const effectiveChatId = session.chatId || cfg.default_chat_id || '0';

  if (session.messageId != null) {
    const editResult = await editTelegramMissionControlMessage(
      { chat_id: effectiveChatId, message_id: session.messageId, text },
      cfg
    );
    if (editResult.ok) {
      session.lastUpdate = Date.now();
      return { ok: true, messageId: editResult.message_id ?? session.messageId };
    }
    session.messageId = null;
  }

  const sendResult = await sendTelegramMissionControlMessage(
    { chat_id: effectiveChatId, text },
    cfg
  );

  if (sendResult.ok && sendResult.message_id != null) {
    session.messageId = sendResult.message_id;
    session.lastUpdate = Date.now();
  }

  return {
    ok: sendResult.ok,
    messageId: sendResult.message_id ?? null,
    error: sendResult.error
  };
}
