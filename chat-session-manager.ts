import { ChatSession, RuntimeSessionState, ProviderKind } from "./chat-types";
import crypto from "crypto";

export function createNewChat(state: RuntimeSessionState, provider: ProviderKind = "openai_api"): ChatSession {
  const id = crypto.randomUUID();
  const count = Object.keys(state.chats).length;
  
  const newChat: ChatSession = {
    id,
    title: `Новый чат ${count + 1}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    provider,
    contextId: crypto.randomUUID(),
    isActive: true,
    stuckCounter: 0
  };

  Object.values(state.chats).forEach(c => c.isActive = false);
  state.chats[id] = newChat;
  state.currentChatId = id;
  return newChat;
}

export function listChats(state: RuntimeSessionState): ChatSession[] {
  return Object.values(state.chats).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function activateChat(state: RuntimeSessionState, chatId: string): void {
  if (!state.chats[chatId]) return;
  Object.values(state.chats).forEach(c => c.isActive = false);
  state.chats[chatId].isActive = true;
  state.currentChatId = chatId;
}

export function renameChat(state: RuntimeSessionState, chatId: string, newTitle: string): boolean {
  const chat = state.chats[chatId];
  if (!chat) return false;
  const title = newTitle.trim();
  if (!title || title.length > 80) return false;
  chat.title = title;
  chat.updatedAt = Date.now();
  return true;
}

export function deleteChat(state: RuntimeSessionState, chatId: string): void {
  if (!state.chats[chatId]) return;
  const wasActive = state.chats[chatId].isActive;
  delete state.chats[chatId];

  if (wasActive) {
    const remaining = listChats(state);
    if (remaining.length > 0) {
      activateChat(state, remaining[0].id);
    } else {
      createNewChat(state);
    }
  }
}

export function getActiveChat(state: RuntimeSessionState): ChatSession {
  if (!state.currentChatId || !state.chats[state.currentChatId]) {
    return createNewChat(state);
  }
  return state.chats[state.currentChatId];
}