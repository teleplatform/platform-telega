import {
  assertCapability,
  getRuntimeRole,
  normalizeUserId,
  type RuntimeRole,
} from "./runtime-access.js";
import {
  validateChatTitle,
  getChatPrefixForUser,
  type ChatPrefix,
} from "./chat-title-policy.js";

export type ActionContext = {
  userId?: string | number | null;
  chatId?: string | number | null;
  chatTitle?: string;
  action?: string;
  capability?: string;
};

const actionLog = ((event: string, payload?: Record<string, unknown>) => {
  console.log(`[action:${event}]`, JSON.stringify(payload || {}));
}) as {
  (event: string, payload?: Record<string, unknown>): void;
  warn: (event: string, payload?: Record<string, unknown>) => void;
};

actionLog.warn = function(event: string, payload?: Record<string, unknown>) {
  console.warn(`[action:${event}]`, JSON.stringify(payload || {}));
};

export interface ActionResult {
  allowed: boolean;
  reason?: string;
  requiresPrefixFix?: string;
}

export function enforceCapability(
  userId: string | number | null | undefined,
  requiredCapability: string,
): ActionResult {
  const id = normalizeUserId(userId);
  const role = getRuntimeRole(id);

  try {
    assertCapability(userId, requiredCapability as any);
    actionLog("capability_allowed", { userId: id, role, capability: requiredCapability });
    return { allowed: true };
  } catch (err: any) {
    actionLog.warn("capability_denied", { userId: id, role, capability: requiredCapability, reason: err.message });
    return { allowed: false, reason: err.message };
  }
}

export function enforcePrefixPolicy(
  userId: string | number | null | undefined,
  chatTitle?: string,
): ActionResult {
  if (!chatTitle) {
    return { allowed: true, reason: "no title to validate" };
  }

  const id = normalizeUserId(userId);
  const validation = validateChatTitle(userId, chatTitle);

  if (validation.valid) {
    actionLog("prefix_valid", { userId: id, title: chatTitle });
    return { allowed: true };
  }

  actionLog.warn("prefix_invalid", { 
    userId: id, 
    title: chatTitle, 
    expected: validation.expectedPrefix,
    fix: validation.requiredRename 
  });

  return { 
    allowed: false, 
    reason: `Title must start with ${validation.expectedPrefix}`,
    requiresPrefixFix: validation.requiredRename,
  };
}

export function enforceFullAccess(
  ctx: ActionContext,
): ActionResult {
  const { userId, chatTitle, capability } = ctx;
  const id = normalizeUserId(userId);

  if (capability) {
    const capResult = enforceCapability(userId, capability);
    if (!capResult.allowed) return capResult;
  }

  if (chatTitle) {
    const prefixResult = enforcePrefixPolicy(userId, chatTitle);
    if (!prefixResult.allowed) return prefixResult;
  }

  return { allowed: true };
}

export function enforceCreatorBridgeAction(
  userId: string | number | null | undefined,
  chatTitle?: string,
): ActionResult {
  const result = enforceFullAccess({
    userId,
    chatTitle,
    capability: "creator_bridge_use",
  });

  if (!result.allowed) {
    actionLog.warn("bridge_action_denied", { 
      userId: normalizeUserId(userId), 
      reason: result.reason 
    });
  }

  return result;
}

export function enforceAdminAction(
  userId: string | number | null | undefined,
): ActionResult {
  const result = enforceCapability(userId, "runtime_admin");

  if (!result.allowed) {
    actionLog.warn("admin_action_denied", { 
      userId: normalizeUserId(userId), 
      reason: result.reason 
    });
  }

  return result;
}

export function enforceDiagnosticAction(
  userId: string | number | null | undefined,
): ActionResult {
  const result = enforceCapability(userId, "diagnostics_full");

  if (!result.allowed) {
    actionLog.warn("diagnostic_action_denied", { 
      userId: normalizeUserId(userId), 
      reason: result.reason 
    });
  }

  return result;
}

export function getActionSummary(userId?: string | number | null): {
  role: RuntimeRole;
  prefix: ChatPrefix;
  canBridge: boolean;
  canAdmin: boolean;
  canDiagnostics: boolean;
} {
  const role = getRuntimeRole(userId);
  const prefix = getChatPrefixForUser(userId);
  const canB = enforceCapability(userId, "creator_bridge_use").allowed;
  const canA = enforceCapability(userId, "runtime_admin").allowed;
  const canD = enforceCapability(userId, "diagnostics_full").allowed;

  return {
    role,
    prefix,
    canBridge: canB,
    canAdmin: canA,
    canDiagnostics: canD,
  };
}