// Permission Resolver — Capability grants and role-based resolution

import type {
  Actor,
  ActorRole,
  Action,
  Capability,
  CapabilityGrant,
  ActorProfile,
  ActionOwnershipRule,
  PermissionDecision,
} from "../../types/authz.js";
import {
  DEFAULT_ACTION_RULES,
  ROLE_DEFAULT_CAPABILITIES,
} from "../../types/authz.js";

export class PermissionResolver {
  private rules: ActionOwnershipRule[];
  private roleCapabilities: Record<ActorRole, Capability[]>;

  constructor(
    rules: ActionOwnershipRule[] = DEFAULT_ACTION_RULES,
    roleCapabilities: Record<ActorRole, Capability[]> = ROLE_DEFAULT_CAPABILITIES
  ) {
    this.rules = rules;
    this.roleCapabilities = roleCapabilities;
  }

  getRoleCapabilities(role: ActorRole): Capability[] {
    return this.roleCapabilities[role] ?? [];
  }

  buildProfile(actor: Actor, extraCapabilities?: CapabilityGrant[]): ActorProfile {
    const baseCapabilities = this.getRoleCapabilities(actor.role);
    const grants: CapabilityGrant[] = baseCapabilities.map((c) => ({ capability: c }));

    if (extraCapabilities) {
      grants.push(...extraCapabilities);
    }

    return {
      actor_id: actor.id,
      role: actor.role,
      capabilities: grants,
      provider_access: this.resolveProviderAccess(actor.role),
      tool_access: this.resolveToolAccess(actor.role),
    };
  }

  private resolveProviderAccess(role: ActorRole): string[] {
    switch (role) {
      case "system":
        return ["*"];
      case "internal":
        return ["*"];
      case "creator":
        return ["openai", "local", "anthropic"];
      case "public":
        return ["local"];
      default:
        return [];
    }
  }

  private resolveToolAccess(role: ActorRole): string[] {
    switch (role) {
      case "system":
        return ["*"];
      case "internal":
        return ["*"];
      case "creator":
        return ["fs.read", "net.fetch"];
      case "public":
        return [];
      default:
        return [];
    }
  }

  hasCapability(profile: ActorProfile, capability: Capability): boolean {
    return profile.capabilities.some((g) => g.capability === capability);
  }

  canAccessProvider(profile: ActorProfile, provider: string): boolean {
    if (profile.provider_access.includes("*")) return true;
    return profile.provider_access.includes(provider);
  }

  canInvokeTool(profile: ActorProfile, tool: string): boolean {
    if (profile.tool_access.includes("*")) return true;
    return profile.tool_access.includes(tool);
  }

  getRuleForAction(action: Action): ActionOwnershipRule | undefined {
    return this.rules.find((r) => r.action === action);
  }

  checkPermission(
    actor: Actor,
    action: Action,
    isOwner: boolean
  ): { decision: PermissionDecision; reason?: string } {
    const rule = this.getRuleForAction(action);
    if (!rule) {
      return { decision: "deny", reason: `no_rule_for_action:${action}` };
    }

    if (actor.isSystem && rule.system_override) {
      return { decision: "allow", reason: "system_override" };
    }

    if (actor.isInternal && rule.internal_override) {
      return { decision: "allow", reason: "internal_override" };
    }

    if (!rule.allowed_roles.includes(actor.role)) {
      return { decision: "deny", reason: `role_not_allowed:${actor.role}` };
    }

    if (rule.requires_ownership && !isOwner) {
      return { decision: "deny", reason: "not_owner" };
    }

    if (rule.requires_capability) {
      const profile = this.buildProfile(actor);
      if (!this.hasCapability(profile, rule.requires_capability)) {
        return { decision: "deny", reason: `missing_capability:${rule.requires_capability}` };
      }
    }

    return { decision: "allow" };
  }
}

export const defaultPermissionResolver = new PermissionResolver();
