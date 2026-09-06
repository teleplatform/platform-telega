import * as fs from "fs";
import * as path from "path";
import { writeLocalProviderEvidence } from"./localEvidence.js";

export type LocalSessionMode = "off" | "auto" | "manual";

export interface LocalSessionState {
  chatId: string;
  userId: string;
  mode: LocalSessionMode;
  providerId?: string;
  providerName?: string;
  lockedAt: number;
  updatedAt: number;
}

const SESSIONS_FILE = path.resolve(".data/local-sessions.json.js");

function ensureDir(): void {
  const dir = path.dirname(SESSIONS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadAllSessions(): Record<string, LocalSessionState> {
  try {
    ensureDir();
    if (!fs.existsSync(SESSIONS_FILE)) return {};
    const raw = fs.readFileSync(SESSIONS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveAllSessions(sessions: Record<string, LocalSessionState>): void {
  try {
    ensureDir();
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf-8");
  } catch {
    // silent
  }
}

export function getLocalSession(chatId: string): LocalSessionState | undefined {
  const sessions = loadAllSessions();
  return sessions[chatId];
}

export function setLocalSession(state: LocalSessionState): void {
  const sessions = loadAllSessions();
  sessions[state.chatId] = { ...state, updatedAt: Date.now() };
  saveAllSessions(sessions);
}

export function clearLocalSession(chatId: string): void {
  const sessions = loadAllSessions();
  delete sessions[chatId];
  saveAllSessions(sessions);
}

export function lockLocalProvider(
  chatId: string,
  userId: string,
  providerId: string,
  providerName: string
): LocalSessionState {
  const state: LocalSessionState = {
    chatId,
    userId,
    mode: "manual",
    providerId,
    providerName,
    lockedAt: Date.now(),
    updatedAt: Date.now(),
  };
  setLocalSession(state);
  writeLocalProviderEvidence("local_session_locked", providerId, providerName, "ollama", { chatId, userId, mode: "manual" });
  return state;
}

export function lockLocalAuto(chatId: string, userId: string): LocalSessionState {
  const state: LocalSessionState = {
    chatId,
    userId,
    mode: "auto",
    lockedAt: Date.now(),
    updatedAt: Date.now(),
  };
  setLocalSession(state);
  writeLocalProviderEvidence("local_session_locked", "auto", "Auto Selector", "ollama", { chatId, userId, mode: "auto" });
  return state;
}

export function unlockLocalSession(chatId: string): void {
  const session = getLocalSession(chatId);
  if (session) {
    writeLocalProviderEvidence("local_session_unlocked", session.providerId || "auto", session.providerName || "Auto", "ollama", { chatId });
  }
  clearLocalSession(chatId);
}

export function isLocalSessionEnabled(chatId: string): boolean {
  const session = getLocalSession(chatId);
  return !!session && session.mode !== "off";
}

export function getLocalSessionSummary(chatId: string): string | null {
  const session = getLocalSession(chatId);
  if (!session || session.mode === "off") return null;

  if (session.mode === "auto") {
    return `🔒 Local Auto — model selected by intent`;
  }

  return `🔒 Local ${session.providerName || session.providerId} — manual lock`;
}
