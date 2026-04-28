import { getRuntimeRole, hasCapability } from "../../core/auth/runtime-access.js";
import type { ChatAction, ChatActionType } from "./chat-surface.types.js";

const CHAT_ACTION_LOGS = "/tmp/chat-actions.log";

export async function canExecuteChatAction(
  userId: string | number,
  actionType: ChatActionType
): Promise<boolean> {
  const role = getRuntimeRole(userId);
  
  const ownerActions: ChatActionType[] = [
    "new_chat", "rename_chat", "archive_chat", "delete_chat",
    "upload_file", "generate_image", "read_aloud", "voice_input",
    "export_chat", "prefix_fix"
  ];
  
  const partnerActions: ChatActionType[] = [
    "new_chat", "upload_file", "generate_image", "read_aloud", 
    "voice_input"
  ];
  
  const publicActions: ChatActionType[] = [
    "new_chat", "upload_file", "generate_image"
  ];
  
  if (role.startsWith("owner_")) {
    return ownerActions.includes(actionType);
  }
  
  if (role === "partner_creator") {
    return partnerActions.includes(actionType);
  }
  
  return publicActions.includes(actionType);
}

export async function executeChatAction(
  userId: string | number,
  chatId: string | number,
  actionType: ChatActionType,
  payload?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  if (!await canExecuteChatAction(userId, actionType)) {
    return { success: false, error: "action_forbidden" };
  }

  try {
    const action: ChatAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: actionType,
      userId: String(userId),
      chatId: String(chatId),
      timestamp: Date.now(),
      payload,
    };

    console.log(`[chat-action] executing ${actionType} for user=${userId}, chat=${chatId}`);

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function processNewChat(
  userId: string | number,
  title?: string
): Promise<{ success: boolean; chatId?: string; error?: string }> {
  return executeChatAction(userId, 0, "new_chat", { title }) as any;
}

export async function processRenameChat(
  userId: string | number,
  chatId: string | number,
  newTitle: string
): Promise<{ success: boolean; error?: string }> {
  return executeChatAction(userId, chatId, "rename_chat", { newTitle }) as any;
}

export async function processArchiveChat(
  userId: string | number,
  chatId: string | number
): Promise<{ success: boolean; error?: string }> {
  return executeChatAction(userId, chatId, "archive_chat") as any;
}

export async function processPrefixFix(
  userId: string | number,
  chatId: string | number,
  observedTitle: string
): Promise<{ success: boolean; requiredRename?: string; error?: string }> {
  const result = await executeChatAction(userId, chatId, "prefix_fix", { observedTitle }) as any;
  return result;
}