import type { ProviderRouteRequest } from "./provider-decision.js";
import type { ProviderProfile } from "./provider-profile.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export interface PolicyCheckResult {
  blocked: boolean;
  reason?: string;
}

export class ProviderPolicy {
  check(profile: ProviderProfile, request: ProviderRouteRequest): PolicyCheckResult {
    if (!profile.enabled) {
      return { blocked: true, reason: `Provider '${profile.provider_id}' is disabled` };
    }

    if (!profile.allowed_modes.includes(request.runtime_mode)) {
      const reason = `Provider '${profile.provider_id}' (${profile.access_tier}) not allowed in '${request.runtime_mode}' mode`;
      appendEvidenceRecord({
        evidence_id: hashTraceId(request.run_id, "provider_mode_blocked"),
        trace_id: request.trace_id,
        job_id: "provider",
        type: "provider_mode_blocked" as any,
        timestamp: new Date().toISOString(),
        payload: {
          provider_id: profile.provider_id,
          access_tier: profile.access_tier,
          runtime_mode: request.runtime_mode,
          allowed_modes: profile.allowed_modes,
        },
      });
      return { blocked: true, reason };
    }

    if (profile.access_tier === "creator_web" && request.runtime_mode === "creator") {
      appendEvidenceRecord({
        evidence_id: hashTraceId(request.run_id, "creator_web_provider_allowed"),
        trace_id: request.trace_id,
        job_id: "provider",
        type: "creator_web_provider_allowed" as any,
        timestamp: new Date().toISOString(),
        payload: {
          provider_id: profile.provider_id,
          runtime_mode: request.runtime_mode,
        },
      });
    }

    if (request.constraints.privacy === "local_only" && profile.privacy.level !== "local") {
      return { blocked: true, reason: `Provider '${profile.provider_id}' is not local-only (${profile.privacy.level})` };
    }

    if (request.constraints.privacy === "sensitive" && !profile.privacy.allow_sensitive) {
      return { blocked: true, reason: `Provider '${profile.provider_id}' does not allow sensitive data` };
    }

    if (request.constraints.cost === "free" && profile.cost.tier !== "free" && profile.cost.tier !== "low") {
      return { blocked: true, reason: `Provider '${profile.provider_id}' cost tier '${profile.cost.tier}' exceeds free/low constraint` };
    }

    if (request.constraints.cost === "low" && profile.cost.tier === "high") {
      return { blocked: true, reason: `Provider '${profile.provider_id}' cost tier 'high' exceeds low constraint` };
    }

    if (request.risk_level === "critical" && profile.privacy.level === "external_web") {
      return { blocked: true, reason: `External web provider blocked at critical risk level` };
    }

    if (request.context.used_tokens > profile.limits.max_context_tokens) {
      return { blocked: true, reason: `Context (${request.context.used_tokens}) exceeds provider limit (${profile.limits.max_context_tokens})` };
    }

    if (request.context.has_images && !profile.limits.supports_images) {
      return { blocked: true, reason: `Provider does not support images` };
    }

    appendEvidenceRecord({
      evidence_id: hashTraceId(request.run_id, "provider_policy_checked"),
      trace_id: request.trace_id,
      job_id: "provider",
      type: "provider_policy_checked" as any,
      timestamp: new Date().toISOString(),
      payload: {
        provider_id: profile.provider_id,
        allowed: true,
        risk_level: request.risk_level,
        runtime_mode: request.runtime_mode,
      },
    });

    return { blocked: false };
  }
}
