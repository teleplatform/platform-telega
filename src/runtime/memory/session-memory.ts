interface SessionTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface SessionData {
  chatId: string;
  turns: SessionTurn[];
  createdAt: number;
  updatedAt: number;
  turnCount: number;
}

const MAX_TURNS = 20;
const sessions = new Map<string, SessionData>();

export function getOrCreateSession(chatId: string): SessionData {
  let session = sessions.get(chatId);
  if (!session) {
    session = { chatId, turns: [], createdAt: Date.now(), updatedAt: Date.now(), turnCount: 0 };
    sessions.set(chatId, session);
  }
  return session;
}

export function addTurn(chatId: string, role: "user" | "assistant", content: string): void {
  const session = getOrCreateSession(chatId);
  session.turns.push({ role, content, timestamp: Date.now() });
  session.turnCount++;
  session.updatedAt = Date.now();
  if (session.turns.length > MAX_TURNS) {
    session.turns = session.turns.slice(-MAX_TURNS);
  }
}

export function getRecentTurns(chatId: string, count = 5): SessionTurn[] {
  const session = sessions.get(chatId);
  if (!session) return [];
  return session.turns.slice(-count);
}

export function getSessionSummary(chatId: string): string {
  const session = sessions.get(chatId);
  if (!session || session.turns.length === 0) return "No conversation history.";
  const lastTurns = session.turns.slice(-3);
  return lastTurns.map(t => `${t.role}: ${t.content.slice(0, 100)}`).join("\n");
}

export function getAllSessionIds(): string[] {
  return Array.from(sessions.keys());
}

export function clearSession(chatId: string): void {
  sessions.delete(chatId);
}

export function getActiveSessionCount(): number {
  return sessions.size;
}
