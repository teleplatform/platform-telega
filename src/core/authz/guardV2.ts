// AuthZ Guard V2 — Pack 2.6
// Mode-aware, capability-aware unified authorization layer

import type { FastifyRequest, FastifyReply } from "fastify";
import type {
  Actor,
  Action,
  ResourceKind,
  AuthZContext,
  PermissionDecision,
  ActorMode,
  PermissionExplain,
  PermissionContext,
  VisibilityScope,
} from "../../types/authz.js";
import { resolveActor } from "./actor.js";
import { resolveActorMode } from "./modes.js";
import { permissionResolverV2 } from "./permissionResolver.js";
import { ownershipRegistry } from "./ownership.js";
import { denyLogger } from "./deny.js";

export interface GuardResultV2 {
  allowed: boolean;
  decision: PermissionDecision;
  reason?: string;
  explain?: PermissionExplain;
  actor: Actor;
  mode: ActorMode;
}

export function getSubjectFromRequest(req: FastifyRequest): string | null {
  const authContext = (req as any).authContext;
  if (authContext?.subject) return authContext.subject;

  const telegramUserId = req.headers["x-telegram-user-id"] as string;
  if (telegramUserId) return `tg:${telegramUserId}`;

  const makerRole = req.headers["x-maker-role"] as string;
  if (makerRole === "true" || makerRole === "1") {
    const makerId = (req.headers["x-maker-id"] as string) ?? "system";
    return `maker:${makerId}`;
  }

  const authHeader = req.headers["authorization"] as string;
  if (authHeader) {
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      return `user:${token.substring(0, 8)}`;
    }
    if (authHeader.startsWith("API-Key ")) {
      const apiKey = authHeader.substring(8);
      return `api:${apiKey.substring(0, 8)}`;
    }
  }

  return null;
}

export function attachAuthZContext(req: FastifyRequest, requestedMode?: string): AuthZContext | null {
  const subject = getSubjectFromRequest(req);
  if (!subject) return null;

  const actor = resolveActor(subject);
  if (!actor) return null;

  const mode = resolveActorMode(actor, requestedMode);

  const { buildCapabilityProfile } = require("./profiles.js");
  const profile = buildCapabilityProfile(actor.id, mode, actor.role);

  (req as any).authZContext = {
    actor,
    profile,
    visibility_policy: null,
    mode,
  } satisfies AuthZContext & { mode: ActorMode };

  return (req as any).authZContext as AuthZContext & { mode: ActorMode };
}

export function getAuthZContext(req: FastifyRequest): (AuthZContext & { mode: ActorMode }) | null {
  return (req as any).authZContext ?? null;
}

export function authzGuardV2(
  actor: Actor,
  mode: ActorMode,
  action: Action,
  resourceKind: ResourceKind,
  resourceId: string,
  visibilityScope: VisibilityScope = "private"
): GuardResultV2 {
  const isOwner = ownershipRegistry.isOwner(resourceKind, resourceId, actor.id);

  const ctx: PermissionContext = {
    actor_id: actor.id,
    actor_mode: mode,
    role: actor.role,
    action,
    resource_kind: resourceKind,
    resource_id: resourceId,
    is_owner: isOwner,
    visibility_scope: visibilityScope,
  };

  const result = permissionResolverV2.resolve(ctx);

  if (result.decision === "allow") {
    return {
      allowed: true,
      decision: result.decision,
      explain: result.explain,
      actor,
      mode,
    };
  }

  denyLogger.logTraceDeny(
    actor.id,
    action,
    resourceKind,
    resourceId,
    result.explain.reason_code
  );

  return {
    allowed: false,
    decision: result.decision,
    reason: result.explain.reason_code,
    explain: result.explain,
    actor,
    mode,
  };
}

export function sessionGuardV2(
  actor: Actor,
  mode: ActorMode,
  action: Action,
  sid: string,
  visibilityScope: VisibilityScope = "private"
): GuardResultV2 {
  return authzGuardV2(actor, mode, action, "session", sid, visibilityScope);
}

export function evidenceGuardV2(
  actor: Actor,
  mode: ActorMode,
  action: Action,
  sid: string
): GuardResultV2 {
  return authzGuardV2(actor, mode, action, "evidence", sid, "private");
}

export function workspaceGuardV2(
  actor: Actor,
  mode: ActorMode,
  action: Action,
  workspaceId: string,
  visibilityScope: VisibilityScope = "private"
): GuardResultV2 {
  return authzGuardV2(actor, mode, action, "workspace", workspaceId, visibilityScope);
}

export function createAuthzMiddlewareV2(options: {
  action: Action;
  resourceKind: ResourceKind;
  resourceIdFn?: (req: FastifyRequest) => string;
}) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const ctx = getAuthZContext(req);
    if (!ctx) {
      return reply.status(401).send({
        ok: false,
        error: { code: "UNAUTHORIZED", message: "No valid actor context" },
      });
    }

    const resourceId = options.resourceIdFn?.(req) ?? "unknown";
    const result = authzGuardV2(
      ctx.actor,
      ctx.mode,
      options.action,
      options.resourceKind,
      resourceId
    );

    if (!result.allowed) {
      return reply.status(403).send({
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: result.reason ?? "Access denied",
          reason: result.reason,
          explain: result.explain,
        },
      });
    }
  };
}
