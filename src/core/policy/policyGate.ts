import type { FastifyReply, FastifyRequest } from "fastify";
import { getIdentity } from "./identity.js";
import { gateError } from "../errors/gateErrors.js";
import { loadPolicyConfig, isModelAllowed } from "./policyConfig.js";
import { setQuotaHeaders, setRateHeaders } from "../limits/headers.js";
import type { CounterStore } from "../limits/limiterStore.js";

type GateDeps = {
  store: CounterStore;
  env: NodeJS.ProcessEnv;
  trace?: (evt: any) => void;
};

function dayKeyUTC() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${da}`;
}

export function buildPolicyGate(deps: GateDeps) {
  const enabled = (deps.env.TELEGPT_GATE_ENABLED ?? "1") === "1";
  const clientIdHeader = deps.env.TELEGPT_CLIENT_ID_HEADER || "x-telegpt-client-id";

  const rlChatPerMin = Number(deps.env.TELEGPT_RL_CHAT_PER_MIN ?? "20");
  const rlModelsPerMin = Number(deps.env.TELEGPT_RL_MODELS_PER_MIN ?? "60");
  const quotaReqPerDay = Number(deps.env.TELEGPT_QUOTA_REQ_PER_DAY ?? "200");
  
  // Policy scope configuration
  const allowedPolicyScopesRaw = deps.env.TELEGPT_ALLOWED_POLICY_SCOPES ?? "worktree";
  const allowedPolicyScopes = allowedPolicyScopesRaw.split(",").map(s => s.trim()).filter(Boolean);

  const policy = loadPolicyConfig(deps.env);

  return async function policyGate(req: FastifyRequest, reply: FastifyReply) {
    if (!enabled) return;

    const identity = getIdentity(req, clientIdHeader);

    // Determine model if present (v1/chat)
    // Expect body: { model: "openai:..." }
    const body: any = (req as any).body || {};
    const model = typeof body?.model === "string" ? body.model : undefined;

    deps.trace?.({ type: "policy.applied", ts: Date.now(), identity, model, path: req.url });

    // ---- 1) Policy
    console.log("Checking policy for model:", model, "allowed:", policy.allowModelPrefixes);
    if (model && !isModelAllowed(model, policy.allowModelPrefixes)) {
      reply.code(403);
      return gateError("POLICY_DENIED", "Model is not allowed by policy", { model, allow: policy.allowModelPrefixes });
    }

    // ---- 1.5) Policy Scope Validation
    const policyScope = body?.policy_scope;
    if (policyScope !== undefined && !allowedPolicyScopes.includes(policyScope)) {
      reply.code(403);
      return gateError("POLICY_SCOPE_DENIED" as any, "Policy scope not allowed by policy", { 
        policy_scope: policyScope, 
        allowed: allowedPolicyScopes 
      });
    }

    // ---- 2) Quota (daily request units)
    const qKey = `quota:${identity.id}:${dayKeyUTC()}`;
    const q = await deps.store.incrWithTtl(qKey, 24 * 60 * 60);
    const qRemaining = quotaReqPerDay - q.value;
    setQuotaHeaders(reply, quotaReqPerDay, qRemaining, q.reset_s);
    deps.trace?.({ type: "quota.checked", ts: Date.now(), identity, value: q.value, limit: quotaReqPerDay });

    if (q.value > quotaReqPerDay) {
      reply.code(429);
      return gateError("QUOTA_EXCEEDED", "Daily quota exceeded", { limit: quotaReqPerDay, reset_s: q.reset_s });
    }

    // ---- 3) Rate limits (per minute)
    // chat endpoint tighter, models endpoint looser
    const isChat = req.url === "/v1/chat";
    const limit = isChat ? rlChatPerMin : rlModelsPerMin;

    const rlKey = `rl:${req.url}:${identity.id}:${Math.floor(Date.now() / 60000)}`;
    const rl = await deps.store.incrWithTtl(rlKey, 60);
    const rlRemaining = limit - rl.value;
    setRateHeaders(reply, limit, rlRemaining, rl.reset_s);
    deps.trace?.({ type: "ratelimit.checked", ts: Date.now(), identity, value: rl.value, limit });

    if (rl.value > limit) {
      reply.code(429);
      return gateError("RATE_LIMITED", "Rate limit exceeded", { limit, reset_s: rl.reset_s });
    }
  };
}