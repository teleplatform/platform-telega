import {
  CHAT_SURFACE_CAPABILITIES,
  DEFAULT_FILE_CONFIG,
  DEFAULT_VOICE_CONFIG,
  LONG_OUTPUT_THRESHOLD,
  type CapabilityGroup,
} from "./chat-surface.types.js";
import { getRuntimeRole, type RuntimeRole } from "../../core/auth/runtime-access.js";

export interface SurfacePolicy {
  allowVoiceInput: boolean;
  allowReadAloud: boolean;
  allowVoiceOutput: boolean;
  allowFileUpload: boolean;
  allowFileReading: boolean;
  allowAutoFileFallback: boolean;
  allowImageGeneration: boolean;
  allowChatActions: boolean;
  maxFileSize: number;
  maxVoiceLength: number;
  maxPreviewLength: number;
}

export const POLICY_BY_ROLE: Record<string, SurfacePolicy> = {
  owner: {
    allowVoiceInput: true,
    allowReadAloud: true,
    allowVoiceOutput: true,
    allowFileUpload: true,
    allowFileReading: true,
    allowAutoFileFallback: true,
    allowImageGeneration: true,
    allowChatActions: true,
    maxFileSize: 512 * 1024 * 1024,
    maxVoiceLength: 120,
    maxPreviewLength: DEFAULT_FILE_CONFIG.maxPreviewLength,
  },
  partner: {
    allowVoiceInput: true,
    allowReadAloud: true,
    allowVoiceOutput: false,
    allowFileUpload: true,
    allowFileReading: true,
    allowAutoFileFallback: true,
    allowImageGeneration: true,
    allowChatActions: true,
    maxFileSize: 256 * 1024 * 1024,
    maxVoiceLength: 60,
    maxPreviewLength: 500,
  },
  public: {
    allowVoiceInput: false,
    allowReadAloud: false,
    allowVoiceOutput: false,
    allowFileUpload: true,
    allowFileReading: false,
    allowAutoFileFallback: true,
    allowImageGeneration: true,
    allowChatActions: false,
    maxFileSize: 50 * 1024 * 1024,
    maxVoiceLength: 0,
    maxPreviewLength: 300,
  },
};

export function getSurfacePolicy(userId: string | number | null): SurfacePolicy {
  const role = getRuntimeRole(userId);
  if (role.startsWith("owner_")) return POLICY_BY_ROLE.owner;
  if (role === "partner_creator") return POLICY_BY_ROLE.partner;
  return POLICY_BY_ROLE.public;
}

export function checkCapability(
  userId: string | number | null,
  capability: string
): { allowed: boolean; reason?: string } {
  const policy = getSurfacePolicy(userId);
  const capabilityMap: Record<string, keyof SurfacePolicy> = {
    voice_input: "allowVoiceInput",
    read_aloud: "allowReadAloud",
    voice_output: "allowVoiceOutput",
    file_upload: "allowFileUpload",
    file_reading: "allowFileReading",
    auto_file_fallback: "allowAutoFileFallback",
    image_generation: "allowImageGeneration",
    chat_actions: "allowChatActions",
  };

  const policyKey = capabilityMap[capability];
  if (!policyKey) {
    return { allowed: false, reason: "unknown_capability" };
  }

  const allowed = Boolean(policy[policyKey]);
  return {
    allowed,
    reason: allowed ? undefined : `capability_disabled_for_role`,
  };
}

export function enforceCapability(
  userId: string | number | null,
  capability: string
): void {
  const check = checkCapability(userId, capability);
  if (!check.allowed) {
    throw new Error(`capability_forbidden: ${capability} - ${check.reason}`);
  }
}

export function canUseFeature(
  userId: string | number | null,
  feature: string
): boolean {
  return checkCapability(userId, feature).allowed;
}

export function getFeatureLimit(
  userId: string | number | null,
  limitType: "maxFileSize" | "maxVoiceLength" | "maxPreviewLength"
): number {
  const policy = getSurfacePolicy(userId);
  return policy[limitType];
}

export function shouldForceFileFallback(
  userId: string | number | null,
  textLength: number,
  contentType?: string
): boolean {
  const policy = getSurfacePolicy(userId);
  
  if (!policy.allowAutoFileFallback) {
    return false;
  }

  if (textLength > LONG_OUTPUT_THRESHOLD) {
    return true;
  }

  if (contentType === "code" && textLength > 2000) {
    return true;
  }

  if (contentType === "json" && textLength > 5000) {
    return true;
  }

  return false;
}

export interface InputValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateInput(params: {
  userId: string | number | null;
  inputType: string;
  textLength?: number;
  fileSize?: number;
  voiceDuration?: number;
  mimeType?: string;
}): InputValidationResult {
  const { userId, inputType, textLength, fileSize, voiceDuration, mimeType } = params;
  const policy = getSurfacePolicy(userId);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (inputType === "voice") {
    if (!policy.allowVoiceInput) {
      errors.push("voice_input_not_allowed");
    }
    if (voiceDuration && voiceDuration > policy.maxVoiceLength) {
      errors.push(`voice_too_long: max ${policy.maxVoiceLength}s`);
    }
  }

  if (inputType === "text") {
    if (textLength && textLength > policy.maxPreviewLength * 10) {
      warnings.push("text_may_be_truncated");
    }
  }

  if (inputType === "file") {
    if (!policy.allowFileUpload) {
      errors.push("file_upload_not_allowed");
    }
    if (fileSize && fileSize > policy.maxFileSize) {
      errors.push(`file_too_large: max ${policy.maxFileSize / 1024 / 1024}MB`);
    }
    if (mimeType && !DEFAULT_FILE_CONFIG.supportedMimeTypes.includes(mimeType)) {
      warnings.push(`unsupported_mime_type: ${mimeType}`);
    }
  }

  if (inputType === "image") {
    if (!policy.allowImageGeneration) {
      errors.push("image_generation_not_allowed");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export const SURFACE_CAPABILITY_MATRIX = {
  owner: {
    voice_input: true,
    read_aloud: true,
    voice_output: true,
    file_upload: true,
    file_reading: true,
    auto_file_fallback: true,
    image_generation: true,
    chat_actions: true,
    safe_content_tools: true,
    creator_bridge: true,
    forge: true,
    vault: true,
    diagnostics: true,
    code_generation: true,
  },
  partner: {
    voice_input: true,
    read_aloud: true,
    voice_output: false,
    file_upload: true,
    file_reading: true,
    auto_file_fallback: true,
    image_generation: true,
    chat_actions: true,
    safe_content_tools: true,
    creator_bridge: false,
    forge: false,
    vault: false,
    diagnostics: false,
    code_generation: false,
  },
  public: {
    voice_input: false,
    read_aloud: false,
    voice_output: false,
    file_upload: true,
    file_reading: false,
    auto_file_fallback: true,
    image_generation: true,
    chat_actions: false,
    safe_content_tools: false,
    creator_bridge: false,
    forge: false,
    vault: false,
    diagnostics: false,
    code_generation: false,
  },
};

export function getCapabilityMatrix(userId: string | number | null): Record<string, boolean> {
  const role = getChatSurfaceRole(userId);
  return SURFACE_CAPABILITY_MATRIX[role] || SURFACE_CAPABILITY_MATRIX.public;
}

function getChatSurfaceRole(userId: string | number | null): "owner" | "partner" | "public" {
  const role = getRuntimeRole(userId);
  if (role.startsWith("owner_")) return "owner";
  if (role === "partner_creator") return "partner";
  return "public";
}

export type { SurfacePolicy, InputValidationResult };