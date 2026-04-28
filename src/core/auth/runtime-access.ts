import { getMakerIds } from "../../intel/makerGate.js";

export type RuntimeRole = "owner_creator_primary" | "owner_creator_secondary" | "partner_creator" | "public";
export type RuntimeMode = "creator" | "public";

export type Capability =
  | "creator_menu"
  | "partner_menu"
  | "creator_tools"
  | "partner_visual_tools"
  | "image_generation"
  | "safe_content_tools"
  | "telega_user_surface"
  | "safe_operator_tools"
  | "creator_bridge_use"
  | "provider_web_sessions"
  | "runtime_admin"
  | "policy_override"
  | "diagnostics_full"
  | "vault_access"
  | "forge_access"
  | "code_generation"
  | "internal_ops"
  | "voice_input"
  | "read_aloud"
  | "voice_output"
  | "file_upload"
  | "file_reading"
  | "auto_file_fallback"
  | "all_chat_actions"
  | "safe_chat_actions";

const OWNER_CREATOR_PRIMARY_IDS = new Set<string>([
  "267246987",
]);

const OWNER_CREATOR_SECONDARY_IDS = new Set<string>([
  "1166943180",
]);

const PARTNER_CREATOR_IDS = new Set<string>([
  "591948691",
]);

export function isOwnerPrimary(userId?: string | number | null): boolean {
  return OWNER_CREATOR_PRIMARY_IDS.has(normalizeUserId(userId));
}

export function isOwnerSecondary(userId?: string | number | null): boolean {
  return OWNER_CREATOR_SECONDARY_IDS.has(normalizeUserId(userId));
}

export function isAnyOwnerCreator(userId?: string | number | null): boolean {
  const id = normalizeUserId(userId);
  return OWNER_CREATOR_PRIMARY_IDS.has(id) || OWNER_CREATOR_SECONDARY_IDS.has(id);
}

export function getOwnerCreatorIds(): Set<string> {
  return new Set([...OWNER_CREATOR_PRIMARY_IDS, ...OWNER_CREATOR_SECONDARY_IDS]);
}

export function getPartnerCreatorIds(): Set<string> {
  return new Set(PARTNER_CREATOR_IDS);
}

export function normalizeUserId(userId?: string | number | null): string {
  return userId == null ? "" : String(userId);
}

export function getRuntimeRole(userId?: string | number | null): RuntimeRole {
  const id = normalizeUserId(userId);
  if (OWNER_CREATOR_PRIMARY_IDS.has(id)) return "owner_creator_primary";
  if (OWNER_CREATOR_SECONDARY_IDS.has(id)) return "owner_creator_secondary";
  if (PARTNER_CREATOR_IDS.has(id)) return "partner_creator";
  return "public";
}

export function getRuntimeMode(userId?: string | number | null): RuntimeMode {
  const role = getRuntimeRole(userId);
  return role === "public" ? "public" : "creator";
}

export function isOwnerCreator(userId?: string | number | null): boolean {
  return isAnyOwnerCreator(userId);
}

export function isPartnerCreator(userId?: string | number | null): boolean {
  return getRuntimeRole(userId) === "partner_creator";
}

export function isAnyCreator(userId?: string | number | null): boolean {
  const role = getRuntimeRole(userId);
  return role.startsWith("owner_creator") || role === "partner_creator";
}

function isAnyOwnerRole(role: RuntimeRole): boolean {
  return role.startsWith("owner_creator");
}

function isPartnerOrAbove(role: RuntimeRole): boolean {
  return role.startsWith("owner_creator") || role === "partner_creator";
}

function isNotPublic(role: RuntimeRole): boolean {
  return role !== "public";
}

export function hasCapability(
  userId?: string | number | null,
  capability?: Capability,
): boolean {
  const role = getRuntimeRole(userId);

  switch (capability) {
    case "creator_menu":
      return isAnyOwnerRole(role);

    case "partner_menu":
      return role === "partner_creator";

    case "creator_tools":
      return isAnyOwnerRole(role) || role === "partner_creator";

    case "partner_visual_tools":
      return role === "partner_creator";

    case "image_generation":
      return isPartnerOrAbove(role);

    case "safe_content_tools":
      return isNotPublic(role);

    case "telega_user_surface":
      return isNotPublic(role);

    case "safe_operator_tools":
      return isPartnerOrAbove(role);

    case "creator_bridge_use":
      return isAnyOwnerRole(role);

    case "provider_web_sessions":
      return isAnyOwnerRole(role);

    case "runtime_admin":
      return isAnyOwnerRole(role);

    case "policy_override":
      return isAnyOwnerRole(role);

    case "diagnostics_full":
      return isAnyOwnerRole(role);

    case "vault_access":
      return isAnyOwnerRole(role);

    case "forge_access":
      return isAnyOwnerRole(role);

    case "code_generation":
      return isAnyOwnerRole(role);

    case "internal_ops":
      return isAnyOwnerRole(role);

    case "voice_input":
      return isPartnerOrAbove(role);

    case "read_aloud":
      return isPartnerOrAbove(role);

    case "voice_output":
      return isAnyOwnerRole(role);

    case "file_upload":
      return true;

    case "file_reading":
      return isPartnerOrAbove(role);

    case "auto_file_fallback":
      return isNotPublic(role);

    case "all_chat_actions":
      return isAnyOwnerRole(role);

    case "safe_chat_actions":
      return isPartnerOrAbove(role);

    default:
      return false;
  }
}

export type AccessLogEvent = 
  | "capability_check"
  | "role_determined"
  | "mode_normalized"
  | "creator_mode_violation"
  | "provider_allowed"
  | "provider_forbidden";

export interface AccessLogPayload {
  userId?: string;
  role?: string;
  capability?: string;
  provider?: string;
  reason?: string;
  requestMode?: string;
}

const accessLog = ((event: AccessLogEvent, payload?: AccessLogPayload) => {
  console.log(`[access:${event}]`, JSON.stringify(payload || {}));
}) as {
  (event: AccessLogEvent, payload?: AccessLogPayload): void;
  warn: (event: AccessLogEvent, payload?: AccessLogPayload) => void;
};

accessLog.warn = function(event: AccessLogEvent, payload?: AccessLogPayload) {
  console.warn(`[access:${event}]`, JSON.stringify(payload || {}));
};

export function assertCapability(
  userId: string | number | null | undefined,
  capability: Capability,
): void {
  if (!hasCapability(userId, capability)) {
    accessLog.warn("capability_check", {
      userId: normalizeUserId(userId),
      role: getRuntimeRole(userId),
      capability,
      reason: "forbidden",
    });
    throw new Error("capability_forbidden");
  }
}

export function assertCreatorRequestAllowed(params: {
  userId?: string | number | null;
  requestMode?: string | null;
}): void {
  const { userId, requestMode } = params;
  const role = getRuntimeRole(userId);

  if (requestMode === "creator" && role === "public") {
    accessLog.warn("creator_mode_violation", {
      userId: normalizeUserId(userId),
      role,
      requestMode,
      reason: "identity_not_allowed",
    });
    throw new Error("creator_mode_forbidden");
  }
}

export type SessionShape = {
  userId?: string | number | null;
  role?: string | null;
  mode?: string | null;
  bridgeEnabled?: boolean | null;
  creatorToolsEnabled?: boolean | null;
};

export function enforceRuntimeAccess<T extends SessionShape>(
  session: T,
): T & {
  role: RuntimeRole;
  mode: RuntimeMode;
  bridgeEnabled: boolean;
  creatorToolsEnabled: boolean;
} {
  const role = getRuntimeRole(session.userId);
  const mode = role === "public" ? "public" : "creator";

  return {
    ...session,
    role,
    mode,
    bridgeEnabled: role.startsWith("owner_creator") ? Boolean(session.bridgeEnabled) : false,
    creatorToolsEnabled: role !== "public",
  };
}

export function assertCreatorProviderAllowed(params: {
  userId?: string | number | null;
  provider: string;
}): void {
  const creatorOnlyProviders = new Set([
    "openai_web",
    "qwen_web",
    "deepseek_web",
    "creator_bridge",
  ]);

  const role = getRuntimeRole(params.userId);

  if (creatorOnlyProviders.has(params.provider) && !role.startsWith("owner_creator")) {
    accessLog.warn("provider_forbidden", {
      userId: normalizeUserId(params.userId),
      role,
      provider: params.provider,
      reason: "provider_requires_owner_creator",
    });
    throw new Error("creator_provider_forbidden");
  }
}

export function getRoleDescription(userId?: string | number | null): string {
  const role = getRuntimeRole(userId);
  const id = normalizeUserId(userId);
  
  if (OWNER_CREATOR_PRIMARY_IDS.has(id)) {
    return `owner_creator_primary (${id})`;
  }
  if (OWNER_CREATOR_SECONDARY_IDS.has(id)) {
    return `owner_creator_secondary (${id})`;
  }
  if (PARTNER_CREATOR_IDS.has(id)) {
    return `partner_creator (${id})`;
  }
  return `public (${id})`;
}