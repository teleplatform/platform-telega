import { getRuntimeRole, isOwnerPrimary, isOwnerSecondary, isPartnerCreator, normalizeUserId } from "./runtime-access.js";

export type ChatPrefix = "★" | "★★" | "★★★" | "";

export interface ChatNamespace {
  userId: string;
  role: string;
  prefix: ChatPrefix;
  validTitles: string[];
}

export function getChatPrefixForUser(userId?: string | number | null): ChatPrefix {
  const id = normalizeUserId(userId);
  
  if (isOwnerPrimary(id)) return "★";
  if (isOwnerSecondary(id)) return "★★";
  if (isPartnerCreator(id)) return "★★★";
  return "";
}

export function getNamespaceForUser(userId?: string | number | null): ChatNamespace {
  const role = getRuntimeRole(userId);
  const prefix = getChatPrefixForUser(userId);
  const id = normalizeUserId(userId);
  
  return {
    userId: id,
    role,
    prefix,
    validTitles: prefix ? [`${prefix} `, `${prefix}. `, `${prefix}: `] : [],
  };
}

export function validateChatTitle(userId: string | number | null, actualTitle: string): {
  valid: boolean;
  expectedPrefix: ChatPrefix;
  requiredRename?: string;
} {
  const namespace = getNamespaceForUser(userId);
  const expectedPrefix = namespace.prefix;
  
  if (!expectedPrefix) {
    return { valid: true, expectedPrefix: "" };
  }
  
  const hasCorrectPrefix = namespace.validTitles.some(prefix => 
    actualTitle.startsWith(prefix)
  );
  
  if (hasCorrectPrefix) {
    return { valid: true, expectedPrefix };
  }
  
  const newTitle = `${expectedPrefix} ${actualTitle}`;
  return {
    valid: false,
    expectedPrefix,
    requiredRename: newTitle,
  };
}

export function getPrefixDescription(prefix: ChatPrefix): string {
  const descriptions: Record<ChatPrefix, string> = {
    "": "public",
    "★": "owner_primary",
    "★★": "owner_secondary", 
    "★★★": "partner",
  };
  return descriptions[prefix] || "unknown";
}