import {
  type InputPayload,
  type OutputPayload,
  type InputType,
  type OutputType,
  CHAT_SURFACE_CAPABILITIES,
  DEFAULT_VOICE_CONFIG,
  DEFAULT_FILE_CONFIG,
} from "./chat-surface.types.js";
import { getRuntimeRole, hasCapability, type RuntimeRole } from "../../core/auth/runtime-access.js";
import { processVoiceInput, canUseVoiceInput } from "./voice-input.js";
import { processReadAloud, canUseReadAloud } from "./read-aloud.js";
import { ingestFile, canUseFileReading, canUseFileUpload, extractTextFromMime } from "./file-ingest.js";
import { shouldUseAutoFileFallback, processAutoFileFallback, formatAutoFileMessage, attachFileToOutput } from "./auto-file-fallback.js";
import { canExecuteChatAction, executeChatAction } from "./chat-actions.js";
import type { ChatActionType } from "./chat-surface.types.js";

export interface SurfaceRouterConfig {
  bot: any;
  imageGenerationFn?: (prompt: string) => Promise<{ ok: boolean; fileId?: string; error?: string }>;
  transcriptionFn?: (filePath: string) => Promise<{ text: string; error?: string }>;
}

let surfaceConfig: SurfaceRouterConfig | null = null;

export function initChatSurfaceRouter(cfg: SurfaceRouterConfig): void {
  surfaceConfig = cfg;
}

export function getChatSurfaceRole(userId: string | number | null): "owner" | "partner" | "public" {
  const role = getRuntimeRole(userId);
  if (role.startsWith("owner_")) return "owner";
  if (role === "partner_creator") return "partner";
  return "public";
}

export function getAllowedCapabilities(userId: string | number | null): string[] {
  const level = getChatSurfaceRole(userId);
  switch (level) {
    case "owner":
      return CHAT_SURFACE_CAPABILITIES.owner;
    case "partner":
      return CHAT_SURFACE_CAPABILITIES.partner;
    case "public":
      return CHAT_SURFACE_CAPABILITIES.public;
  }
}

export function hasSurfaceCapability(userId: string | number | null, capability: string): boolean {
  const role = getRuntimeRole(userId);
  if (role.startsWith("owner_")) return true;
  return hasCapability(userId, capability as any);
}

export async function routeInput(payload: InputPayload): Promise<{
  ok: boolean;
  normalizedText?: string;
  attachedContent?: string;
  error?: string;
}> {
  const { type, userId, voiceFileId, fileId, fileName, mimeType, text } = payload;

  if (!type) {
    return { ok: false, error: "input_type_required" };
  }

  const role = getRuntimeRole(userId ?? null);

  switch (type) {
    case "text": {
      if (!text?.trim()) {
        return { ok: false, error: "text_required" };
      }
      return { ok: true, normalizedText: text.trim() };
    }

    case "voice": {
      if (!voiceFileId) {
        return { ok: false, error: "voice_file_id_required" };
      }
      if (!await canUseVoiceInput(userId ?? null)) {
        return { ok: false, error: "voice_input_forbidden" };
      }
      if (!surfaceConfig?.bot) {
        return { ok: false, error: "surface_not_initialized" };
      }
      try {
        const result = await processVoiceInput(userId!, voiceFileId, surfaceConfig.bot);
        if (!result.success) {
          return { ok: false, error: result.error };
        }
        return { ok: true, normalizedText: result.text };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    }

    case "file": {
      if (!fileId || !fileName) {
        return { ok: false, error: "file_id_and_name_required" };
      }
      if (!await canUseFileUpload(userId ?? null)) {
        return { ok: false, error: "file_upload_forbidden" };
      }
      if (!await canUseFileReading(userId ?? null)) {
        return { ok: false, error: "file_reading_forbidden" };
      }
      try {
        const ingestResult = await ingestFile(userId!, fileId, fileName, mimeType || "application/octet-stream");
        if (!ingestResult.normalized) {
          return { ok: false, error: "file_type_not_supported" };
        }
        return { ok: true, attachedContent: ingestResult.content };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    }

    case "image": {
      if (!fileId) {
        return { ok: false, error: "image_file_id_required" };
      }
      if (!await canUseFileUpload(userId ?? null)) {
        return { ok: false, error: "file_upload_forbidden" };
      }
      return {
        ok: true,
        attachedContent: `[image: ${fileId}]`,
      };
    }

    default:
      return { ok: false, error: "unknown_input_type" };
  }
}

export async function routeOutput(params: {
  text: string;
  userId: string | number;
  chatId: string | number;
  requestedOutput?: OutputType;
}): Promise<{
  ok: boolean;
  outputs: OutputPayload[];
  error?: string;
}> {
  const { text, userId, chatId, requestedOutput } = params;
  const outputs: OutputPayload[] = [];

  if (!surfaceConfig?.bot) {
    return { ok: false, outputs: [], error: "surface_not_initialized" };
  }

  if (requestedOutput === "voice" || requestedOutput === "mixed") {
    if (await canUseReadAloud(userId)) {
      const voiceResult = await processReadAloud(userId, text, surfaceConfig.bot);
      if (voiceResult.success) {
        outputs.push({
          type: "voice",
          voiceFileId: voiceResult.voiceFileId,
        });
      }
    }
  }

  if (requestedOutput === "file" || !requestedOutput || requestedOutput === "mixed") {
    if (shouldUseAutoFileFallback(text)) {
      const fileResult = await processAutoFileFallback(text, "response");
      if (fileResult.needsFallback) {
        outputs.push({
          type: "file",
          preview: fileResult.preview,
          fileName: fileResult.fileName,
          text: fileResult.fileContent,
        });
      }
    }
  }

  if (outputs.length === 0 || requestedOutput === "text" || requestedOutput === "mixed") {
    outputs.push({
      type: "text",
      text,
    });
  }

  return { ok: true, outputs };
}

export async function executeSurfaceAction(params: {
  userId: string | number;
  chatId: string | number;
  action: ChatActionType;
  payload?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  const { userId, chatId, action, payload } = params;

  const actionCapabilities: Record<ChatActionType, string> = {
    new_chat: "all_chat_actions",
    rename_chat: "all_chat_actions",
    archive_chat: "all_chat_actions",
    delete_chat: "all_chat_actions",
    upload_file: "file_upload",
    generate_image: "image_generation",
    read_aloud: "read_aloud",
    voice_input: "voice_input",
    export_chat: "all_chat_actions",
    prefix_fix: "all_chat_actions",
  };

  const requiredCap = actionCapabilities[action];
  if (requiredCap && !hasSurfaceCapability(userId, requiredCap)) {
    return { ok: false, error: "action_forbidden" };
  }

  return executeChatAction(userId, chatId, action, payload);
}

export async function handleImageGeneration(params: {
  userId: string | number;
  prompt: string;
}): Promise<{ ok: boolean; fileId?: string; error?: string }> {
  if (!hasSurfaceCapability(params.userId, "image_generation")) {
    return { ok: false, error: "image_generation_forbidden" };
  }

  if (!surfaceConfig?.imageGenerationFn) {
    return { ok: false, error: "image_generation_not_configured" };
  }

  return surfaceConfig.imageGenerationFn(params.prompt);
}

export async function sendOutputWithFallback(params: {
  chatId: string | number;
  text: string;
}): Promise<{ ok: boolean; messageIds?: number[]; method: string }> {
  if (!surfaceConfig?.bot) {
    return { ok: false, method: "none" };
  }

  const { chatId, text } = params;

  if (shouldUseAutoFileFallback(text)) {
    const fileResult = await processAutoFileFallback(text, "response");
    if (fileResult.needsFallback && fileResult.fileName && fileResult.fileContent) {
      const fileSent = await attachFileToOutput(
        surfaceConfig.bot,
        chatId,
        fileResult.fileName,
        fileResult.fileContent
      );
      if (fileSent.fileSent) {
        const previewText = formatAutoFileMessage(fileResult);
        if (previewText) {
          const msg = await surfaceConfig.bot.telegram.sendMessage(chatId, previewText);
          return { ok: true, messageIds: [msg.message_id, fileSent.messageId!], method: "file+preview" };
        }
        return { ok: true, messageIds: [fileSent.messageId!], method: "file" };
      }
    }
  }

  const msg = await surfaceConfig.bot.telegram.sendMessage(chatId, text);
  return { ok: true, messageIds: [msg.message_id], method: "text" };
}

export {
  getChatSurfaceRole,
  getAllowedCapabilities,
  hasSurfaceCapability,
  routeInput,
  routeOutput,
  executeSurfaceAction,
  handleImageGeneration,
  sendOutputWithFallback,
} from "./chat-surface-router.js";

export {
  getSurfacePolicy,
  checkCapability,
  enforceCapability,
  canUseFeature,
  getFeatureLimit,
  validateInput,
} from "./chat-surface-policy.js";