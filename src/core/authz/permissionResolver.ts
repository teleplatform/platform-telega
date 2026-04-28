// Permission Resolver — Pack 2.3
// Mode-aware, capability-aware, explainable permission decisions

import type {
  ActorMode,
  ActorRole,
  ActorId,
  Action,
  ResourceKind,
  Capability,
  PermissionDecision,
  PermissionExplain,
  PermissionContext,
} from "../../types/authz.js";
import { buildCapabilityProfile, hasCapability, canAccessProvider, canInvokeTool } from "./profiles.js";
import { modeGte } from "../../types/authz.js";

export interface RouterPermissionContext {
  actor_mode: ActorMode;
  capabilities: string[];
  allowed_provider_ids?: string[];
  allowed_tool_ids?: string[];
}

export interface PermissionDecisionResult {
  decision: PermissionDecision;
  explain: PermissionExplain;
}

export class PermissionResolverV2 {
  resolve(ctx: PermissionContext): PermissionDecisionResult {
    const profile = buildCapabilityProfile(ctx.actor_id, ctx.actor_mode, ctx.role);
    const explain: string[] = [];
    let deniedBy: string | undefined;
    let grantedBy: string | undefined;
    const matchedCapabilities: Capability[] = [];

    // Step 1: System override
    if (ctx.actor_mode === "system") {
      return {
        decision: "allow",
        explain: {
          actor_id: ctx.actor_id,
          actor_mode: ctx.actor_mode,
          action: ctx.action,
          resource_kind: ctx.resource_kind,
          resource_id: ctx.resource_id,
          decision: "allow",
          granted_by: "system_override",
          matched_capabilities: [],
          effective_mode: "system",
          effective_role: ctx.role,
          reason_code: "SYSTEM_OVERRIDE",
          explain: ["system mode grants unconditional access"],
          checked_at: new Date().toISOString(),
        },
      };
    }

    // Step 2: Ownership check
    if (requiresOwnership(ctx.action) && !ctx.is_owner) {
      const denyReason = `not_owner:${ctx.resource_kind}:${ctx.resource_id}`;
      return {
        decision: "deny",
        explain: {
          actor_id: ctx.actor_id,
          actor_mode: ctx.actor_mode,
          action: ctx.action,
          resource_kind: ctx.resource_kind,
          resource_id: ctx.resource_id,
          decision: "deny",
          denied_by: "ownership_check",
          matched_capabilities: [],
          effective_mode: ctx.actor_mode,
          effective_role: ctx.role,
          reason_code: "NOT_OWNER",
          explain: [
            `action ${ctx.action} requires ownership`,
            `actor is not owner of ${ctx.resource_kind}:${ctx.resource_id}`,
          ],
          checked_at: new Date().toISOString(),
        },
      };
    }

    // Step 3: Visibility scope check
    if (!passesVisibilityCheck(ctx)) {
      return {
        decision: "deny",
        explain: {
          actor_id: ctx.actor_id,
          actor_mode: ctx.actor_mode,
          action: ctx.action,
          resource_kind: ctx.resource_kind,
          resource_id: ctx.resource_id,
          decision: "deny",
          denied_by: "visibility_scope",
          matched_capabilities: [],
          effective_mode: ctx.actor_mode,
          effective_role: ctx.role,
          reason_code: "VISIBILITY_DENIED",
          explain: [
            `visibility_scope=${ctx.visibility_scope} does not allow access`,
          ],
          checked_at: new Date().toISOString(),
        },
      };
    }

    // Step 4: Capability check
    const requiredCap = getRequiredCapability(ctx.action);
    if (requiredCap && !hasCapability(profile, requiredCap)) {
      matchedCapabilities.push(requiredCap);
      return {
        decision: "deny",
        explain: {
          actor_id: ctx.actor_id,
          actor_mode: ctx.actor_mode,
          action: ctx.action,
          resource_kind: ctx.resource_kind,
          resource_id: ctx.resource_id,
          decision: "deny",
          denied_by: `missing_capability:${requiredCap}`,
          matched_capabilities: matchedCapabilities,
          effective_mode: ctx.actor_mode,
          effective_role: ctx.role,
          reason_code: "MISSING_CAPABILITY",
          explain: [
            `action ${ctx.action} requires capability: ${requiredCap}`,
            `mode=${ctx.actor_mode} does not grant ${requiredCap}`,
          ],
          checked_at: new Date().toISOString(),
        },
      };
    }

    // Step 5: Provider access check (if provider_id specified)
    if (ctx.provider_id) {
      if (!canAccessProvider(profile, ctx.provider_id)) {
        return {
          decision: "deny",
          explain: {
            actor_id: ctx.actor_id,
            actor_mode: ctx.actor_mode,
            action: ctx.action,
            resource_kind: ctx.resource_kind,
            resource_id: ctx.resource_id,
            decision: "deny",
            denied_by: `provider_access:${ctx.provider_id}`,
            matched_capabilities: matchedCapabilities,
            effective_mode: ctx.actor_mode,
            effective_role: ctx.role,
            reason_code: "PROVIDER_DENIED",
            explain: [
              `provider ${ctx.provider_id} not allowed for mode=${ctx.actor_mode}`,
            ],
            checked_at: new Date().toISOString(),
          },
        };
      }
    }

    // Step 6: Tool access check (if tool_id specified)
    if (ctx.tool_id) {
      if (!canInvokeTool(profile, ctx.tool_id)) {
        return {
          decision: "deny",
          explain: {
            actor_id: ctx.actor_id,
            actor_mode: ctx.actor_mode,
            action: ctx.action,
            resource_kind: ctx.resource_kind,
            resource_id: ctx.resource_id,
            decision: "deny",
            denied_by: `tool_access:${ctx.tool_id}`,
            matched_capabilities: matchedCapabilities,
            effective_mode: ctx.actor_mode,
            effective_role: ctx.role,
            reason_code: "TOOL_DENIED",
            explain: [
              `tool ${ctx.tool_id} not allowed for mode=${ctx.actor_mode}`,
            ],
            checked_at: new Date().toISOString(),
          },
        };
      }
    }

    // All checks passed
    if (requiredCap) matchedCapabilities.push(requiredCap);
    grantedBy = `capability:${requiredCap || "implicit"}`;
    explain.push(`all checks passed for action=${ctx.action}`);
    if (requiredCap) explain.push(`capability ${requiredCap} granted`);

    return {
      decision: "allow",
      explain: {
        actor_id: ctx.actor_id,
        actor_mode: ctx.actor_mode,
        action: ctx.action,
        resource_kind: ctx.resource_kind,
        resource_id: ctx.resource_id,
        decision: "allow",
        granted_by: grantedBy,
        matched_capabilities: matchedCapabilities,
        effective_mode: ctx.actor_mode,
        effective_role: ctx.role,
        reason_code: "ALL_CHECKS_PASSED",
        explain,
        checked_at: new Date().toISOString(),
      },
    };
  }
}

function requiresOwnership(action: Action): boolean {
  const ownershipRequired: Action[] = [
    "agent.stream",
    "agent.status",
    "evidence.verify",
    "evidence.read",
    "workspace.read",
    "workspace.write",
    "task.read",
    "task.update",
    "artifact.read",
    "artifact.write",
  ];
  return ownershipRequired.includes(action);
}

function getRequiredCapability(action: Action): Capability | undefined {
  const map: Record<Action, Capability | undefined> = {
    "agent.run": "run_agent",
    "agent.stream": "read_stream",
    "agent.status": "read_status",
    "evidence.verify": "verify_evidence",
    "evidence.read": "read_evidence",
    "workspace.read": "read_workspace",
    "workspace.write": "write_workspace",
    "task.create": "create_task",
    "task.read": "read_task",
    "task.update": "update_task",
    "artifact.read": "read_artifact",
    "artifact.write": "write_artifact",
  };
  return map[action];
}

function passesVisibilityCheck(ctx: PermissionContext): boolean {
  if (ctx.actor_mode === "system" || ctx.actor_mode === "internal") return true;
  if (ctx.is_owner) return true;
  if (ctx.visibility_scope === "public") return true;
  if (ctx.visibility_scope === "shared") {
    return ctx.actor_mode === "creator";
  }
  return false;
}

export const permissionResolverV2 = new PermissionResolverV2();

export function buildRouterPermissionContext(
  actorId: ActorId,
  mode: ActorMode,
  role: ActorRole
): RouterPermissionContext {
  const profile = buildCapabilityProfile(actorId, mode, role);
  return {
    actor_mode: mode,
    capabilities: Array.from(profile.capabilities),
    allowed_provider_ids: [...profile.provider_access],
    allowed_tool_ids: [...profile.tool_access],
  };
}
