import Fastify from "fastify";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import type { MissionControlBuildTaskEventSeverity } from "../runtime/mission-control/build-task-event.js";
import type { ChatRequest, ChatResponse } from "../types/chat.js";
import { routeChat } from "../core/router.js";
import { buildAgentSystemPrompt, DEFAULT_SALES_TEMPLATE } from "../core/agent.js";
import { keywordIntent } from "../core/intent.js";
import type { Intent, IntentType, KnowledgePack } from "../types/agent.js";
import {
  pickLane,
  buildProviderChain,
  getLaneConfig,
  type ProviderSpec,
  type LaneResult,
  type Lane,
} from "../core/policyRouter.js";
import { extractTaggedText } from "./llm/extract.js";
import { runWithFallback } from "../core/llmFallback.js";
import { CircuitBreaker } from "../core/circuitBreaker.js";
import { buildForgeSpecFromMessage, toBuildTask } from "../core/g2f.js";
import { initSqlite } from "./storage/sqlite.js";
import { chooseProvider } from "./provider/strategy.js";
import { guardCreatorOnlyBaseUrl } from "./env/guard.js";
import type {
  AskRequest,
  AskResponse,
  ApiErrorCode,
  ApiErrorResponse,
  BuildTaskSummaryResponse,
  BuildTaskDetailResponse,
  BuildTaskListItem,
  BuildTaskListResponse,
  TraceListResponse,
  CreatorDecisionRequest,
  CreatorDecisionResponse,
} from "../types/api.js";
import type { BuildResult, BuildTask } from "../types/telecore.js";
import { dispatchBuildTask } from "../runtime/forge-bridge/job-dispatcher.js";
import { getRetryDecision, getNextRetryAt, DEFAULT_BACKOFF_POLICY } from "../runtime/forge-bridge/retry-policy.js";
import { createBuildTaskMissionEvent } from "../runtime/mission-control/build-task-event.js";
import { emitMissionControlLiveEvent } from "../runtime/hooks/mission-control-live-feed-hook.js";
import { appendMissionControlPersistenceFeed } from "../runtime/mission-control/operational-runtime.js";
import { deliverBuildTaskMissionEvent } from "../runtime/mission-control/delivery/telegram-build-task-delivery.js";

type HeartbeatRequest = {
  runner_id?: string;
  progress?: number;
  note?: string;
};

function hexId24() {
  return crypto.randomBytes(12).toString("hex");
}

function apiError(
  trace_id: string,
  code: ApiErrorCode,
  message: string
): ApiErrorResponse {
  return { trace_id, error: { code, message } };
}

function safeJsonParse(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function clampLimit(limit: number | undefined) {
  const v = Number.isFinite(limit as number) ? Number(limit) : 20;
  return Math.min(Math.max(v, 1), 100);
}

function parseTaskStatus(v: unknown) {
  if (typeof v !== "string") return undefined;
  if (v === "queued" || v === "running" || v === "retrying" || v === "done" || v === "partial" || v === "blocked" || v === "failed" || v === "cancelled" || v === "timed_out" || v === "self_healing" || v === "needs_creator") {
    return v;
  }
  return "INVALID";
}

function parseTaskVisibility(v: unknown) {
  if (typeof v !== "string") return undefined;
  if (v === "public" || v === "creator" || v === "core") return v;
  return "INVALID";
}

function isValidBuildTask(b: any): b is BuildTask {
  return !!b && b.type === "build_task" && b.version === "1.0" && b.goal && typeof b.goal.title === "string";
}

function withStale(
  row: { status: string; heartbeat_at?: number | null; progress?: number | null },
  now: number,
  staleMs: number
) {
  const heartbeat_at = row.heartbeat_at ?? null;
  const heartbeat_age_ms =
    row.status === "running" && heartbeat_at !== null ? now - heartbeat_at : null;
  const stale =
    row.status === "running" &&
    (heartbeat_at === null || (heartbeat_age_ms !== null && heartbeat_age_ms > staleMs));

  return {
    heartbeat_at,
    heartbeat_age_ms,
    progress: row.progress ?? null,
    stale,
  };
}

export async function buildServer() {
  const app = Fastify({ logger: true });

  const dataDir = process.env.TELEGPT_DATA_DIR ?? ".data";
  const dbPath = path.join(dataDir, "tele-gpt.sqlite");
  const store = initSqlite(dbPath);
  const staleMs =
    Number(process.env.TELEGPT_TASK_STALE_MS ?? "90000") || 90000;

  // Load knowledge pack
  let knowledgePack: KnowledgePack | undefined;
  const knowledgePath = process.env.TELEGPT_KNOWLEDGE_PATH;
  if (knowledgePath && fs.existsSync(knowledgePath)) {
    try {
      const raw = fs.readFileSync(knowledgePath, "utf-8");
      knowledgePack = JSON.parse(raw);
      app.log.info({ path: knowledgePath }, "Loaded knowledge pack");
    } catch (err) {
      app.log.warn({ err, path: knowledgePath }, "Failed to load knowledge pack");
    }
  }

  const agentEnabled = process.env.TELEGPT_AGENT_MODE === "true";
  const systemPrompt = agentEnabled
    ? buildAgentSystemPrompt(DEFAULT_SALES_TEMPLATE, knowledgePack)
    : undefined;

  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    windowMs: 60000,
    cooldownMs: 120000,
  });

  function mapMissionBuildTaskSeverityToLiveSeverity(
    severity: MissionControlBuildTaskEventSeverity
  ): "critical" | "high" | "medium" | "low" | "info" {
    switch (severity) {
      case "critical":
        return "critical";
      case "error":
        return "high";
      case "warning":
        return "medium";
      case "success":
        return "low";
      case "info":
      default:
        return "info";
    }
  }

  // KCA-6.3a — extracted helpers for single retry/finalize path (shared across dispatch and stale sweep)
  function finalizeDispatchResult(task_id: string, dispatched: any, traceId: string) {
    const finalStatus = dispatched.summary.status as any;
    const effectiveTraceId = dispatched.execution?.trace_id ?? traceId;
    const canonical: BuildResult = {
      type: "build_result",
      version: "1.0",
      summary: dispatched.summary,
      execution: dispatched.execution,
      diagnostics: (dispatched as any).diagnostics,
    };
    store.setBuildResult({
      task_id,
      status: finalStatus,
      result_json: JSON.stringify(canonical),
      updated_at: Date.now(),
      completed_at: Date.now(),
      executor_target: (dispatched as any).executor?.target || null,
      executor_id: (dispatched as any).executor?.id || null,
      last_error: (dispatched as any).diagnostics?.error || null,
    });

    store.markBuildTaskCompleted({
      task_id,
      now: Date.now(),
      status: finalStatus,
      last_error: (dispatched as any).diagnostics?.error || null,
    });
  }

  function handleDispatchFailureWithRetryPolicy(
    task_id: string,
    failureStatus: string,
    dispatchedOrError: any,
    traceId: string
  ) {
    const current = store.getBuildTask(task_id);
    const decision = getRetryDecision({
      status: failureStatus,
      retry_count: current?.retry_count ?? 0,
    });

    const errorMsg = typeof dispatchedOrError === "string" 
      ? dispatchedOrError 
      : String(dispatchedOrError?.diagnostics?.error || dispatchedOrError);

    if (decision.can_retry) {
      const newCount = (current?.retry_count ?? 0) + 1;
      const now = Date.now();
      const nextRetryAt = getNextRetryAt(now, newCount - 1, DEFAULT_BACKOFF_POLICY);

      store.updateBuildTaskCAS({
        task_id,
        expected_version: current?.version ?? 0,
        patch: {
          status: "retrying",
          retry_count: newCount,
          last_error: errorMsg,
          next_retry_at: nextRetryAt,
        },
        now,
      } as any);

      const mcEvent = createBuildTaskMissionEvent({
        event_type: "build_task.retry_scheduled",
        task_id,
        status: "retrying",
        last_error: errorMsg,
        retry_count: newCount,
      });

      void emitMissionControlLiveEvent({
        kind: "execution_failed",
        severity: mapMissionBuildTaskSeverityToLiveSeverity(mcEvent.severity),
        title: `BuildTask retry scheduled (${newCount}/${decision.max_attempts}) after ${nextRetryAt - now}ms: ${task_id}`,
        trace_id: task_id,
        payload: mcEvent,
      });
      appendMissionControlPersistenceFeed(mcEvent as any);
      void deliverBuildTaskMissionEvent(mcEvent);
    } else if (decision.reason === "retry_budget_exhausted") {
      const resumeToken = crypto.randomUUID();
      store.updateBuildTaskCAS({
        task_id,
        expected_version: current?.version ?? 0,
        patch: {
          status: "needs_creator",
          last_error: errorMsg,
          needs_creator_reason: "retry_budget_exhausted",
          decision_options: JSON.stringify(["approve_retry", "cancel_task", "mark_blocked"]),
          resume_token: resumeToken,
          creator_decision_status: "pending",
          creator_decision_at: Date.now(),
        },
        now: Date.now(),
      } as any);

      const mcEvent = createBuildTaskMissionEvent({
        event_type: "build_task.needs_creator",
        task_id,
        status: "needs_creator",
        last_error: errorMsg,
      });

      void emitMissionControlLiveEvent({
        kind: "approval_required",
        severity: mapMissionBuildTaskSeverityToLiveSeverity(mcEvent.severity),
        title: `BuildTask needs creator (retries exhausted): ${task_id}`,
        trace_id: task_id,
        payload: mcEvent,
      });
      appendMissionControlPersistenceFeed(mcEvent as any);
      void deliverBuildTaskMissionEvent(mcEvent);
    } else {
      const canonicalFailed: BuildResult = {
        type: "build_result",
        version: "1.0",
        summary: {
          status: "failed",
          task_id,
          mode_used: "smart",
          iterations_used: 0,
        },
        diagnostics: { error: errorMsg },
      };
      store.setBuildResult({
        task_id,
        status: "failed",
        result_json: JSON.stringify(canonicalFailed),
        updated_at: Date.now(),
        completed_at: Date.now(),
        last_error: errorMsg,
      });
      store.markBuildTaskFailed({
        task_id,
        now: Date.now(),
        last_error: errorMsg,
      });
    }
  }

  app.get("/health", async () => {
    return { ok: true };
  });

  app.get("/ready", async () => {
    return { ok: true, ready: true };
  });

  const requireCreator = (reply: any) => {
    const mode = process.env.TELEGA_MODE?.trim().toLowerCase();
    if (mode !== "creator") {
      reply.status(403);
      return apiError("auth", "FORBIDDEN", "Maker-only endpoint");
    }
    return null;
  };

  const toIso = (ms: number) => new Date(ms).toISOString();

  // --- Product Knowledge: packs/docs/versions (Maker CRUD)
  // Static routes are registered before KB-2 /v1/knowledge/:business_id to avoid ambiguity.

  app.get("/v1/knowledge/packs", async (req, reply) => {
    const denied = requireCreator(reply);
    if (denied) return denied;

    const limitRaw = (req.query as any)?.limit;
    const limit = typeof limitRaw === "string" ? Number(limitRaw) : undefined;
    const rows = store.listKnowledgePacks({ limit });
    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        scope: r.scope,
        owner_id: r.owner_id,
        is_active: Boolean(r.is_active),
        created_at: toIso(r.created_at),
      })),
    };
  });

  app.post<{ Body: { title: string; scope: "global" | "store" | "service"; owner_id?: string; is_active?: boolean } }>(
    "/v1/knowledge/packs",
    async (req, reply) => {
      const denied = requireCreator(reply);
      if (denied) return denied;

      const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
      const scope = req.body?.scope;
      const owner_id = typeof req.body?.owner_id === "string" ? req.body.owner_id.trim() : "default";
      const is_active = typeof req.body?.is_active === "boolean" ? req.body.is_active : true;

      if (!title) {
        return reply.status(400).send(apiError("knowledge", "BAD_REQUEST", "title is required"));
      }
      if (scope !== "global" && scope !== "store" && scope !== "service") {
        return reply.status(400).send(apiError("knowledge", "BAD_REQUEST", "invalid scope"));
      }

      const id = hexId24();
      const created_at = Date.now();
      store.createKnowledgePack({ id, title, scope, owner_id, is_active, created_at });

      return {
        id,
        title,
        scope,
        owner_id,
        is_active,
        created_at: toIso(created_at),
      };
    }
  );

  app.put<{ Params: { id: string }; Body: { is_active: boolean } }>(
    "/v1/knowledge/packs/:id",
    async (req, reply) => {
      const denied = requireCreator(reply);
      if (denied) return denied;

      const id = req.params.id;
      const is_active = req.body?.is_active;
      if (typeof is_active !== "boolean") {
        return reply
          .status(400)
          .send(apiError("knowledge", "BAD_REQUEST", "is_active must be boolean"));
      }

      const r = store.setKnowledgePackActive({ id, is_active });
      if (r.changed <= 0) {
        return reply.status(404).send(apiError(id, "NOT_FOUND", "pack not found"));
      }
      return { ok: true };
    }
  );

  app.get<{ Params: { id: string } }>(
    "/v1/knowledge/packs/:id/docs",
    async (req, reply) => {
      const denied = requireCreator(reply);
      if (denied) return denied;

      const limitRaw = (req.query as any)?.limit;
      const limit = typeof limitRaw === "string" ? Number(limitRaw) : undefined;
      const rows = store.listKnowledgeDocs({ pack_id: req.params.id, limit });
      return {
        items: rows.map((d) => ({
          id: d.id,
          pack_id: d.pack_id,
          kind: d.kind,
          title: d.title,
          body_md: d.body_md,
          updated_at: toIso(d.updated_at),
        })),
      };
    }
  );

  app.post<{ Body: { pack_id: string; kind: string; title: string; body_md: string } }>(
    "/v1/knowledge/docs",
    async (req, reply) => {
      const denied = requireCreator(reply);
      if (denied) return denied;

      const pack_id = typeof req.body?.pack_id === "string" ? req.body.pack_id.trim() : "";
      const kind = typeof req.body?.kind === "string" ? req.body.kind.trim() : "";
      const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
      const body_md = typeof req.body?.body_md === "string" ? req.body.body_md : "";

      if (!pack_id || !title || !kind) {
        return reply.status(400).send(apiError("knowledge", "BAD_REQUEST", "pack_id, kind, title required"));
      }

      const id = hexId24();
      const updated_at = Date.now();
      store.createKnowledgeDoc({ id, pack_id, kind, title, body_md, updated_at });
      return { id, pack_id, kind, title, body_md, updated_at: toIso(updated_at) };
    }
  );

  app.put<{ Params: { id: string }; Body: { kind?: string; title?: string; body_md?: string } }>(
    "/v1/knowledge/docs/:id",
    async (req, reply) => {
      const denied = requireCreator(reply);
      if (denied) return denied;

      const id = req.params.id;
      const kind = typeof req.body?.kind === "string" ? req.body.kind.trim() : undefined;
      const title = typeof req.body?.title === "string" ? req.body.title.trim() : undefined;
      const body_md = typeof req.body?.body_md === "string" ? req.body.body_md : undefined;

      const r = store.updateKnowledgeDoc({
        id,
        kind: kind ?? null,
        title: title ?? null,
        body_md: typeof body_md === "string" ? body_md : null,
        updated_at: Date.now(),
      });

      if (r.changed <= 0) {
        return reply.status(404).send(apiError(id, "NOT_FOUND", "doc not found"));
      }

      const doc = store.getKnowledgeDoc({ id });
      return {
        id,
        pack_id: doc?.pack_id,
        kind: doc?.kind,
        title: doc?.title,
        body_md: doc?.body_md,
        updated_at: doc ? toIso(doc.updated_at) : null,
      };
    }
  );

  app.post<{ Params: { id: string } }>(
    "/v1/knowledge/docs/:id/publish",
    async (req, reply) => {
      const denied = requireCreator(reply);
      if (denied) return denied;

      const doc_id = req.params.id;
      const version_id = hexId24();
      const created_at = Date.now();
      const r = store.publishKnowledgeDoc({ doc_id, version_id, created_at });
      if (!r.ok) {
        return reply.status(404).send(apiError(doc_id, "NOT_FOUND", "doc not found"));
      }
      return { id: version_id, doc_id, created_at: toIso(created_at) };
    }
  );

  // --- Sales/Support Agent
  app.post<{ Body: { message: string; mode: "sales" | "support"; scope?: "global" | "store" | "service"; intent_hint?: string } }>(
    "/v1/agent/sales-support/ask",
    async (req, reply) => {
      const t = hexId24();
      const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
      const mode = req.body?.mode === "sales" ? "sales" : "support";
      const scope = req.body?.scope ?? "global";
      const intent_hint = typeof req.body?.intent_hint === "string" ? req.body.intent_hint.trim() : undefined;

      if (!message) {
        return reply.status(400).send(apiError(t, "BAD_REQUEST", "message is required"));
      }
      if (scope !== "global" && scope !== "store" && scope !== "service") {
        return reply.status(400).send(apiError(t, "BAD_REQUEST", "invalid scope"));
      }

      const packs = store.listActiveKnowledgePacksByScope({ scope, limit: 50 });
      const docs = packs.flatMap((p) => store.listKnowledgeDocs({ pack_id: p.id, limit: 200 }));

      const tokens = message
        .toLowerCase()
        .split(/[^a-z0-9а-яё]+/i)
        .map((s) => s.trim())
        .filter((s) => s.length >= 3)
        .slice(0, 24);

      const scored = docs
        .map((d) => {
          const hay = `${d.title}\n${d.body_md}`.toLowerCase();
          let score = 0;
          for (const tok of tokens) {
            if (hay.includes(tok)) score += 1;
          }
          return { d, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      const citations = scored.map((x) => {
        const snippet = x.d.body_md.slice(0, 240);
        return { pack_id: x.d.pack_id, doc_id: x.d.id, snippet };
      });

      // If no LLM providers available, return deterministic decision (anti-magic fallback)
      const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY?.trim());
      const localBaseRaw = process.env.LOCAL_OPENAI_BASE_URL?.trim();
      const guarded = guardCreatorOnlyBaseUrl({
        baseUrlEnvName: "LOCAL_OPENAI_BASE_URL",
        baseUrlValue: localBaseRaw,
        logger: app.log,
      });
      const hasLocalBase = Boolean(guarded.baseUrl);
      if (guarded.baseUrl) {
        process.env.LOCAL_OPENAI_BASE_URL = guarded.baseUrl;
      }

      const fallbackDecision = {
        mode,
        intent: citations.length > 0 ? "faq" : "unknown",
        confidence: citations.length > 0 ? 0.65 : 0.3,
        answer:
          citations.length > 0
            ? `${citations[0].snippet}`
            : "I don’t have enough information in the knowledge base. Please describe what you need, and I will help.",
        actions:
          citations.length > 0
            ? [
                {
                  type: "request_info",
                  label: "Ask one clarifying question",
                  payload: { question: "What exactly do you need help with?" },
                },
              ]
            : [
                {
                  type: "handoff_human",
                  label: "Escalate to human",
                  payload: { reason: "no_matching_docs" },
                },
              ],
        citations,
        safety: {
          needs_human: citations.length === 0,
          reason: citations.length === 0 ? "no_knowledge" : undefined,
        },
      };

      if (!hasOpenAIKey && !hasLocalBase) {
        store.insertAgentTrace({
          trace_id: t,
          mode,
          message,
          decision_json: JSON.stringify(fallbackDecision),
          citations_json: JSON.stringify(citations),
          provider: "local",
          model: "local-demo",
          created_at: Date.now(),
          ok: 1,
        });
        return { trace_id: t, decision: fallbackDecision };
      }

      const classifierSystem = [
        "You are Tele•GPT Sales/Support Agent.",
        "Follow these hard rules:",
        "- Output ONLY one tag: <json>{...}</json>",
        "- JSON must match AgentDecision schema.",
        "- If knowledge is insufficient or risky, set safety.needs_human=true and add handoff_human action.",
        "- Never promise facts not present in citations.",
        "- Ask at most one clarifying question (via actions.request_info).",
        "",
        `MODE: ${mode}`,
        intent_hint ? `INTENT_HINT: ${intent_hint}` : "",
        "",
        "CITED_DOCS:",
        ...citations.map((c, i) => `#${i + 1} pack_id=${c.pack_id} doc_id=${c.doc_id}\n${c.snippet}`),
        "",
        "AgentDecision JSON schema:",
        JSON.stringify({
          mode: "support",
          intent: "faq",
          confidence: 0.7,
          answer: "string",
          actions: [{ type: "request_info", label: "string", payload: {} }],
          citations: [{ pack_id: "...", doc_id: "...", snippet: "..." }],
          safety: { needs_human: false, reason: "" },
        }),
      ]
        .filter(Boolean)
        .join("\n");

      // Use existing INTENT-2 lane selection infra as a cheap heuristic
      const kw = keywordIntent(message);
      const lane: Lane = kw.confidence >= 0.8 ? "cheap" : "smart";

      const envModels = {
        has_openai_key: hasOpenAIKey,
        has_local_base_url: hasLocalBase,
        local_default_model: process.env.LOCAL_OPENAI_MODEL?.trim(),
        cheap_model: process.env.TELEGPT_MODEL_CHEAP,
        smart_model: process.env.TELEGPT_MODEL_SMART,
        coding_model: process.env.TELEGPT_MODEL_CODING,
      };

      const fullChain = buildProviderChain(lane, envModels);
      const chain = fullChain.filter((spec) => {
        const isOpen = circuitBreaker.isOpen(spec.provider, spec.model);
        return !isOpen || spec.model === "local-demo";
      });

      const callProvider = async (spec: ProviderSpec, chatReq: ChatRequest) => {
        const modelWithPrefix = `${spec.provider}:${spec.model}`;
        try {
          const response = await routeChat({
            ...chatReq,
            model: modelWithPrefix,
          });
          circuitBreaker.recordSuccess(spec.provider, spec.model);
          return response;
        } catch (err) {
          circuitBreaker.recordFailure(spec.provider, spec.model);
          throw err;
        }
      };

      const llm = await runWithFallback(chain, callProvider, {
        message,
        request_id: `${t}_agent`,
        system: classifierSystem,
      } as ChatRequest);

      const jsonText = extractTaggedText(llm.reply, "json");
      const parsed = safeJsonParse(jsonText);

      // Minimal validation
      const decision =
        parsed && typeof parsed === "object" && typeof parsed.answer === "string" && Array.isArray(parsed.actions)
          ? {
              mode: parsed.mode === "sales" ? "sales" : "support",
              intent: typeof parsed.intent === "string" ? parsed.intent : "unknown",
              confidence:
                typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
                  ? Math.min(Math.max(parsed.confidence, 0), 1)
                  : 0.3,
              answer: parsed.answer,
              actions: parsed.actions,
              citations: Array.isArray(parsed.citations) ? parsed.citations : citations,
              safety: parsed.safety && typeof parsed.safety === "object" ? parsed.safety : { needs_human: false },
            }
          : fallbackDecision;

      // Optionally map heavy actions to tasks
      const heavy = new Set(["open_ticket", "create_quote", "apply_loyalty"]);
      const enrichedActions: any[] = [];
      for (const a of decision.actions ?? []) {
        if (a && typeof a === "object" && heavy.has(a.type)) {
          const taskPayload: any = {
            type: "build_task",
            version: "1.0",
            meta: {
              task_id: "auto",
              created_at: Date.now(),
              priority: "normal",
              mode: "smart",
              persona: "tele-gpt",
              ecosystem: "telega",
              visibility: "creator",
            },
            goal: {
              title: a.label || `Action: ${a.type}`,
              description: `Requested by agent (${mode})`,
            },
            spec: {
              skill_kind:
                a.type === "open_ticket"
                  ? "support_ticket"
                  : a.type === "create_quote"
                  ? "sales_quote"
                  : "loyalty_apply",
              payload: a.payload ?? {},
            },
          };

          const created = await app.inject({
            method: "POST",
            url: "/v1/build/tasks",
            payload: taskPayload,
          });
          const createdJson = created.statusCode === 200 ? (created.json() as any) : null;
          const task_id = createdJson?.task_id;
          enrichedActions.push({
            ...a,
            payload: { ...(a.payload ?? {}), task_id },
          });
        } else {
          enrichedActions.push(a);
        }
      }

      const finalDecision = { ...decision, actions: enrichedActions, citations };

      store.insertAgentTrace({
        trace_id: t,
        mode,
        message,
        decision_json: JSON.stringify(finalDecision),
        citations_json: JSON.stringify(citations),
        provider: llm.provider,
        model: llm.model,
        created_at: Date.now(),
        ok: 1,
      });

      return {
        trace_id: t,
        decision: finalDecision,
        meta: {
          provider: llm.provider,
          model: llm.model,
          lane,
        },
      };
    }
  );

  // KB-2: GET knowledge pack
  app.get<{ Params: { business_id: string } }>(
    "/v1/knowledge/:business_id",
    async (req, reply) => {
      const business_id = req.params.business_id;
      const pack = store.getKb2KnowledgePack(business_id);
      if (!pack) {
        return reply
          .status(404)
          .send(apiError(business_id, "NOT_FOUND", "knowledge pack not found"));
      }
      return {
        business_id: pack.business_id,
        version: pack.version,
        updated_at: pack.updated_at,
        payload: safeJsonParse(pack.payload_json),
        etag: pack.etag,
      };
    }
  );

  // KB-2: PUT knowledge pack (Maker-only, CAS via expected_version)
  app.put<{ Params: { business_id: string }; Body: { payload: any; expected_version?: number } }>(
    "/v1/knowledge/:business_id",
    async (req, reply) => {
      const mode = process.env.TELEGA_MODE?.trim().toLowerCase();
      if (mode !== "creator") {
        return reply
          .status(403)
          .send(apiError("auth", "FORBIDDEN", "Maker-only endpoint"));
      }

      const business_id = req.params.business_id;
      const payload = req.body?.payload;
      const expected_version = req.body?.expected_version;

      if (payload === undefined) {
        return reply
          .status(400)
          .send(apiError(business_id, "BAD_REQUEST", "payload field required"));
      }
      if (typeof expected_version !== "undefined" && typeof expected_version !== "number") {
        return reply
          .status(400)
          .send(apiError(business_id, "BAD_REQUEST", "expected_version must be a number"));
      }

      const result = store.putKb2KnowledgePack({
        business_id,
        payload_json: JSON.stringify(payload),
        expected_version,
      });

      if (!result.ok) {
        return reply.status(409).send(
          apiError(
            business_id,
            "KNOWLEDGE_CONFLICT",
            `expected_version=${expected_version}, current_version=${result.current_version}`
          )
        );
      }

      return {
        business_id: result.business_id,
        version: result.version,
        updated_at: result.updated_at,
        etag: result.etag,
      };
    }
  );

  // G2F-1: Generate BuildTask from a free-form message
  app.post<{ Body: { message: string; visibility?: string } }>(
    "/v1/forge/tasks/create",
    async (req, reply) => {
      const msg = (req.body?.message || "").trim();
      const visibilityRaw = (req.body?.visibility || "creator").trim();
      const visibility =
        visibilityRaw === "public" || visibilityRaw === "creator" || visibilityRaw === "core"
          ? visibilityRaw
          : "creator";

      if (!msg) {
        return reply.status(400).send(apiError("forge", "BAD_REQUEST", "message is required"));
      }

      const spec = buildForgeSpecFromMessage(msg);
      if (!spec) {
        return reply
          .status(400)
          .send(apiError("forge", "BAD_REQUEST", "no actionable spec detected"));
      }

      const task = toBuildTask(spec, visibility as any);

      // Reuse existing build task endpoint internally
      const r = await app.inject({
        method: "POST",
        url: "/v1/build/tasks",
        payload: task,
      });

      reply.code(r.statusCode);
      reply.headers(r.headers as any);
      return r.json();
    }
  );

  app.post<{ Body: AskRequest; Querystring: { knowledge_business_id?: string } }>("/v1/ask", async (req, reply) => {
    const t = hexId24();
    const msg = (req.body?.message ?? "").trim();
    const user_id =
      typeof req.body?.user_id === "string" ? req.body.user_id : undefined;

    if (!msg) {
      return reply.status(400).send(apiError(t, "BAD_REQUEST", "message is required"));
    }

    const start = Date.now();

    // Resolve knowledge pack for this request
    const business_id = typeof req.query?.knowledge_business_id === "string" && req.query.knowledge_business_id.trim() ? req.query.knowledge_business_id.trim() : "default";
    let knowledge_source: "db" | "file" | "none" = "none";
    let knowledge_version: number | undefined;
    let knowledgeForReq: KnowledgePack | undefined;

    const dbPack = store.getKb2KnowledgePack(business_id);
    if (dbPack) {
      knowledge_source = "db";
      knowledge_version = dbPack.version;
      knowledgeForReq = safeJsonParse(dbPack.payload_json) ?? undefined;
    } else if (knowledgePack) {
      knowledge_source = "file";
      knowledgeForReq = knowledgePack;
    }

    // Provider config (needed for INTENT-2 LLM fallback and for final answer)
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const localBaseRaw = process.env.LOCAL_OPENAI_BASE_URL?.trim();
    const guarded = guardCreatorOnlyBaseUrl({
      baseUrlEnvName: "LOCAL_OPENAI_BASE_URL",
      baseUrlValue: localBaseRaw,
      logger: app.log,
    });
    if (guarded.baseUrl) {
      process.env.LOCAL_OPENAI_BASE_URL = guarded.baseUrl;
    }
    const localBase = guarded.baseUrl;
    const localModel = process.env.LOCAL_OPENAI_MODEL?.trim();

    const envModels = {
      has_openai_key: Boolean(apiKey),
      has_local_base_url: Boolean(localBase),
      local_default_model: localModel,
      cheap_model: process.env.TELEGPT_MODEL_CHEAP,
      smart_model: process.env.TELEGPT_MODEL_SMART,
      coding_model: process.env.TELEGPT_MODEL_CODING,
    };

    // Provider caller function with circuit breaker
    const callProvider = async (spec: ProviderSpec, chatReq: ChatRequest) => {
      const modelWithPrefix = `${spec.provider}:${spec.model}`;
      try {
        const response = await routeChat({
          ...chatReq,
          model: modelWithPrefix,
        });
        circuitBreaker.recordSuccess(spec.provider, spec.model);
        return response;
      } catch (err) {
        circuitBreaker.recordFailure(spec.provider, spec.model);
        throw err;
      }
    };

    // INTENT-2: keyword → (LLM fallback if low confidence)
    const intentThresholdRaw = Number(process.env.TELEGPT_INTENT_THRESHOLD ?? "0.75");
    const INTENT_THRESHOLD =
      Number.isFinite(intentThresholdRaw)
        ? Math.min(Math.max(intentThresholdRaw, 0), 1)
        : 0.75;

    const kw = keywordIntent(msg);
    let intent: Intent = { type: kw.intent, confidence: kw.confidence };
    let intent_source: "keyword" | "llm" = "keyword";
    let intent_reason = kw.reason;

    const normalizeIntentType = (v: unknown): IntentType | null => {
      if (typeof v !== "string") return null;
      const s = v.trim();
      if (
        s === "buy" ||
        s === "inquiry" ||
        s === "booking" ||
        s === "delivery" ||
        s === "warranty" ||
        s === "complaint" ||
        s === "general"
      ) {
        return s;
      }
      return null;
    };

    if (kw.confidence < INTENT_THRESHOLD) {
      const llmLaneRaw = String(process.env.TELEGPT_INTENT_LLM_LANE ?? "cheap")
        .trim()
        .toLowerCase();
      const llmLane: Lane =
        llmLaneRaw === "smart" || llmLaneRaw === "coding" ? llmLaneRaw : "cheap";

      const classifierSystem = [
        "You are an intent classifier for Tele•GPT.",
        "Classify the user message into exactly one intent:",
        "buy | inquiry | booking | delivery | warranty | complaint | general",
        "Return ONLY a single XML tag: <json>{...}</json>",
        "JSON schema: {\"intent\":string,\"confidence\":number,\"reason\":string}",
        "confidence must be between 0 and 1.",
        "reason must be short (<=200 chars).",
      ].join("\n");

      try {
        const classifierFullChain = buildProviderChain(llmLane, envModels);
        const classifierChain = classifierFullChain.filter((spec) => {
          const isOpen = circuitBreaker.isOpen(spec.provider, spec.model);
          return !isOpen || spec.model === "local-demo";
        });

        const r = await runWithFallback(classifierChain, callProvider, {
          message: msg,
          request_id: `${t}_intent`,
          system: classifierSystem,
        } as ChatRequest);

        const jsonText = extractTaggedText(r.reply, "json");
        const parsed = safeJsonParse(jsonText);

        const parsedIntent = normalizeIntentType(parsed?.intent);
        const parsedConfidence =
          typeof parsed?.confidence === "number" && Number.isFinite(parsed.confidence)
            ? Math.min(Math.max(parsed.confidence, 0), 1)
            : null;
        const parsedReason = typeof parsed?.reason === "string" ? parsed.reason : null;

        if (parsedIntent && parsedConfidence !== null) {
          intent = { type: parsedIntent, confidence: parsedConfidence };
          intent_source = "llm";
          intent_reason = (parsedReason ?? "llm_classified").slice(0, 200);
        }
      } catch (err) {
        app.log.warn({ err }, "INTENT-2 llm intent classification failed; falling back to keyword intent");
      }
    }

    const overrides = knowledgeForReq?.policy_hints?.intent_overrides;

    const defaultLaneResult: LaneResult | undefined = agentEnabled
      ? pickLane(intent, msg)
      : undefined;
    const laneResult: LaneResult = agentEnabled
      ? pickLane(intent, msg, overrides)
      : { lane: "smart", source: "default" };

    const lane = laneResult.lane;
    const laneSource = laneResult.source;
    const policy_override_used =
      Boolean(agentEnabled) &&
      laneSource === "override" &&
      Boolean(defaultLaneResult) &&
      defaultLaneResult!.lane !== lane;

    const laneConfig = getLaneConfig(lane);

    if (agentEnabled) {
      app.log.info(
        {
          intent,
          intent_source,
          lane,
          lane_source: laneSource,
          policy_override_used,
          message: msg,
        },
        "Detected intent and lane"
      );
    }

    // Build provider chain based on lane
    const fullChain = buildProviderChain(lane, envModels);

    // Filter out providers with open circuit breakers
    const chain = fullChain.filter((spec) => {
      const isOpen = circuitBreaker.isOpen(spec.provider, spec.model);
      if (isOpen) {
        app.log.warn({ provider: spec.provider, model: spec.model }, "Circuit breaker open, skipping provider");
      }
      return !isOpen || spec.model === "local-demo"; // Always allow local-demo fallback
    });

    app.log.info({ lane, chain: chain.map(c => `${c.provider}:${c.model}`) }, "Provider chain");

    // Run with fallback
    let replyText = "";
    let provider: "local" | "openai" = "local";
    let model = "local-demo";
    let mode: AskResponse["mode"] = "echo";
    let ok: 1 | 0 = 1;
    let error_code: ApiErrorCode | undefined;
    let error_message: string | undefined;
    let tokens_in: number | undefined;
    let tokens_out: number | undefined;
    let cost_usd: number | undefined;
    let fallback_used = false;
    let failures_count = 0;
    let attempt_number = 1;

    // Build system prompt from request-specific knowledge
    const requestSystemPrompt = agentEnabled && knowledgeForReq
      ? buildAgentSystemPrompt(DEFAULT_SALES_TEMPLATE, knowledgeForReq)
      : systemPrompt;

    try {
      const result = await runWithFallback(chain, callProvider, {
        message: msg,
        request_id: t,
        system: requestSystemPrompt,
      } as ChatRequest);

      replyText = result.reply;
      provider = result.provider as "local" | "openai";
      model = result.model;
      mode = provider === "openai" ? "openai" : "echo";
      fallback_used = result.fallback_used;
      failures_count = result.failures.length;
      attempt_number = result.attempt_number;

      if (result.meta?.usage) {
        tokens_in = result.meta.usage.tokens_in;
        tokens_out = result.meta.usage.tokens_out;
        cost_usd = result.meta.usage.cost_usd;
      }

      if (result.failures.length > 0) {
        app.log.warn({ failures: result.failures, lane }, "Provider fallback occurred");
      }
    } catch (_err) {
      ok = 0;
      error_code = "UPSTREAM_ERROR";
      error_message = "all providers failed";
    }

    const duration_ms = Date.now() - start;
    const latency_ms = duration_ms;
    const request_bytes = Buffer.byteLength(msg, "utf8");
    const reply_bytes = Buffer.byteLength(replyText, "utf8");

    store.insertTrace({
      trace_id: t,
      message: msg,
      reply: replyText,
      mode,
      provider,
      model,
      user_id,
      created_at: Date.now(),
      ok,
      duration_ms,
      latency_ms,
      request_bytes,
      reply_bytes,
      tokens_in,
      tokens_out,
      cost_usd,
      error_code,
      error_message,
      knowledge_source,
      knowledge_business_id: business_id,
      knowledge_version: knowledge_version ?? null,
    });

    if (ok === 0) {
      return reply.status(502).send(apiError(t, "UPSTREAM_ERROR", "upstream error"));
    }

    // G2F-1: Check if message is actionable and auto-create BuildTask
    // Guardrail: avoid creating tasks for casual chat.
    let generatedTaskId: string | undefined;
    if (agentEnabled) {
      const spec = buildForgeSpecFromMessage(msg);

      const explicitForge = (() => {
        const lower = msg.toLowerCase();
        return (
          /(^|\s)@forge\b/i.test(msg) ||
          /(^|\s)\/forge\b/i.test(msg) ||
          lower.includes("сделай тз") ||
          lower.includes("собери")
        );
      })();

      const minRaw = Number(process.env.TELEGPT_G2F_INTENT_CONFIDENCE_MIN ?? "0.8");
      const G2F_MIN_CONF =
        Number.isFinite(minRaw) ? Math.min(Math.max(minRaw, 0), 1) : 0.8;

      const ACTIONABLE_INTENTS: ReadonlySet<IntentType> = new Set(["booking", "buy"]);
      const intentActionable =
        ACTIONABLE_INTENTS.has(intent.type) && intent.confidence >= G2F_MIN_CONF;

      const allowed = Boolean(spec) && (explicitForge || intentActionable);

      if (spec && allowed) {
        try {
          const task = toBuildTask(spec, "creator");
          const taskResp = await app.inject({
            method: "POST",
            url: "/v1/build/tasks",
            payload: task,
          });
          if (taskResp.statusCode === 200) {
            const taskData = taskResp.json() as { task_id?: string };
            generatedTaskId = taskData.task_id;
            app.log.info(
              { task_id: generatedTaskId, spec: spec.skill_kind },
              "Auto-generated BuildTask"
            );
          }
        } catch (err) {
          app.log.warn({ err, spec }, "Failed to auto-generate BuildTask");
        }
      } else if (spec) {
        app.log.info(
          {
            spec: spec.skill_kind,
            explicitForge,
            intent: intent.type,
            intent_confidence: intent.confidence,
            min_confidence: G2F_MIN_CONF,
          },
          "Skipped auto BuildTask (actionability gate)"
        );
      }
    }

    const res: AskResponse = {
      trace_id: t,
      reply: replyText,
      mode,
      meta: {
        provider,
        model,
        duration_ms,
        lane,
        lane_source: laneSource,
        intent: intent.type,
        intent_confidence: intent.confidence,
        intent_source,
        intent_reason: intent_reason.slice(0, 200),
        fallback_used,
        failures_count,
        attempt_number,
        max_tokens: laneConfig.max_tokens,
        timeout_ms: laneConfig.timeout_ms,
        knowledge_source,
        knowledge_business_id: business_id,
        knowledge_version: knowledge_version ?? null,
        policy_override_used,
        generated_task_id: generatedTaskId,
      },
    };

    return res;
  });

  app.get<{ Params: { trace_id: string } }>(
    "/v1/traces/:trace_id",
    async (req, reply) => {
      const row = store.getTrace(req.params.trace_id);
      if (!row) {
        return reply
          .status(404)
          .send(apiError(req.params.trace_id, "NOT_FOUND", "trace not found"));
      }
      return row;
    }
  );

  app.get<{ Querystring: { user_id?: string; limit?: string } }>(
    "/v1/traces",
    async (req) => {
      const user_id =
        typeof req.query?.user_id === "string" ? req.query.user_id : undefined;
      const limitRaw = req.query?.limit;
      const limit = typeof limitRaw === "string" ? Number(limitRaw) : undefined;

      const items = store.listHistory({ user_id, limit: clampLimit(limit) });
      const res: TraceListResponse = { items };
      return res;
    }
  );

  app.get<{ Params: { trace_id: string } }>("/v1/trace/:trace_id", async (req, reply) => {
    const r = await app.inject({
      method: "GET",
      url: `/v1/traces/${encodeURIComponent(req.params.trace_id)}`,
    });
    reply.code(r.statusCode);
    reply.headers(r.headers as any);
    return r.json();
  });

  app.get<{ Querystring: { user_id?: string; limit?: string } }>(
    "/v1/history",
    async (req, reply) => {
      const qs = new URLSearchParams();
      if (typeof req.query?.user_id === "string") qs.set("user_id", req.query.user_id);
      if (typeof req.query?.limit === "string") qs.set("limit", req.query.limit);

      const url = qs.toString() ? `/v1/traces?${qs.toString()}` : "/v1/traces";
      const r = await app.inject({ method: "GET", url });
      reply.code(r.statusCode);
      reply.headers(r.headers as any);
      return r.json();
    }
  );

  app.post<{ Body: BuildTask }>("/v1/build/tasks", async (req, reply) => {
    const body = req.body as BuildTask | undefined;
    const t = hexId24();

    if (!body || body.type !== "build_task" || body.version !== "1.0") {
      return reply
        .status(400)
        .send(apiError(t, "BAD_REQUEST", "invalid build task"));
    }

    const title =
      typeof body.goal?.title === "string" ? body.goal.title.trim() : "";
    if (!title) {
      return reply
        .status(400)
        .send(apiError(t, "BAD_REQUEST", "goal.title is required"));
    }

    const visibility =
      body.meta?.visibility === "public" ||
      body.meta?.visibility === "creator" ||
      body.meta?.visibility === "core"
        ? body.meta.visibility
        : "creator";

    const task_id =
      (typeof (body as any).task_id === "string" && (body as any).task_id !== "auto"
        ? (body as any).task_id
        : body.meta?.task_id && body.meta.task_id !== "auto"
        ? body.meta.task_id
        : hexId24());

    const now = Date.now();
    const task_json = JSON.stringify({
      ...body,
      meta: { ...body.meta, task_id },
    });

    store.upsertBuildTask({
      task_id,
      status: "queued",
      visibility,
      title,
      task_json,
      created_at: now,
      updated_at: now,
      queued_at: now,
    } as any);

    // KCA-5.2: emit queued lifecycle event
    {
      const mcEvent = createBuildTaskMissionEvent({
        event_type: "build_task.queued",
        task_id,
        status: "queued",
        title,
      });
      void emitMissionControlLiveEvent({
        kind: "attention_queued",
        severity: mcEvent.severity,
        title: `BuildTask queued: ${task_id}`,
        trace_id: task_id,
        payload: mcEvent,
      });
      appendMissionControlPersistenceFeed(mcEvent as any);

      void deliverBuildTaskMissionEvent(mcEvent);
    }

    // KCA-2.1: queue fast, execute owned in background, HTTP returns immediately
    if (isValidBuildTask(body)) {
      const traceId = hexId24();

      queueMicrotask(() => {
        // KCA-4.3: use safe mark method for start
        const startNow = Date.now();
        store.markBuildTaskStarted({
          task_id,
          now: startNow,
          executor_target: (body as any).execution?.target || "auto",
        });

        dispatchBuildTask(body as BuildTask, traceId)
          .then((dispatched) => {
            const finalStatus = dispatched.summary.status as any;

            if (finalStatus === "failed" || finalStatus === "timed_out") {
              handleDispatchFailureWithRetryPolicy(task_id, finalStatus, dispatched, traceId);
            } else {
              finalizeDispatchResult(task_id, dispatched, traceId);
            }
          })
          .catch((err) => {
            handleDispatchFailureWithRetryPolicy(task_id, "failed", err, traceId);
          });
      });
    }

    return {
      task_id,
      status: "queued",
      immediate_status: "queued",
      dispatch_mode: "async",
      poll_url: `/v1/build/tasks/${task_id}`,
    };
  });

  app.post<{ Params: { task_id: string }; Body: BuildResult }>(
    "/v1/build/tasks/:task_id/result",
    async (req, reply) => {
      const t = hexId24();
      const task_id = req.params?.task_id;
      const body = req.body as BuildResult | undefined;

      if (!body || body.type !== "build_result" || body.version !== "1.0") {
        return reply
          .status(400)
          .send(apiError(t, "BAD_REQUEST", "invalid build result"));
      }

      const status = body.summary?.status;
      if (status !== "done" && status !== "partial" && status !== "blocked" && status !== "failed" && status !== "cancelled" && status !== "timed_out") {
        return reply
          .status(400)
          .send(apiError(t, "BAD_REQUEST", "invalid status"));
      }

      const resultTaskId = (body as any).task_id || body.summary?.task_id;
      if (resultTaskId && resultTaskId !== task_id) {
        return reply
          .status(400)
          .send(apiError(t, "BAD_REQUEST", "task_id mismatch"));
      }

      const task = store.getBuildTask(task_id);
      if (!task) {
        return reply
          .status(404)
          .send(apiError(task_id, "NOT_FOUND", "task not found"));
      }

      // KCA-4.1 Lifecycle semantics:
      // terminal     = final states, no further execution
      // protected    = cannot regress without explicit Creator action
      // self_healing = transitional recovery mode (can move to running/failed/needs_creator/done)
      // needs_creator = paused, waiting for explicit human decision
      const terminal = new Set(["done", "partial", "blocked", "failed", "cancelled", "timed_out"]);
      const protectedStates = new Set([...terminal, "needs_creator"]);

      if (protectedStates.has(task.status)) {
        return reply
          .status(409)
          .send(apiError(task_id, "STATUS_CONFLICT", `task already ${task.status}`));
      }

      const ok = store.setBuildResult({
        task_id,
        status,
        result_json: JSON.stringify(body),
        updated_at: Date.now(),
      });

      if (!ok) {
        return reply
          .status(409)
          .send(apiError(task_id, "STATUS_CONFLICT", "failed to update status"));
      }

      return { task_id, status };
    }
  );

  app.post<{ Params: { task_id: string }; Body: HeartbeatRequest }>(
    "/v1/build/tasks/:task_id/heartbeat",
    async (req, reply) => {
      const task_id = req.params.task_id;
      const body = req.body ?? {};

      let progress: number | undefined;
      if (typeof body.progress === "number") {
        if (!Number.isFinite(body.progress) || body.progress < 0 || body.progress > 100) {
          return reply
            .status(400)
            .send(apiError(task_id, "BAD_REQUEST", "progress must be 0..100"));
        }
        progress = Math.round(body.progress);
      }

      const runner_id =
        typeof body.runner_id === "string" && body.runner_id.trim()
          ? body.runner_id.trim()
          : undefined;

      const note =
        typeof body.note === "string" && body.note.trim()
          ? body.note.trim().slice(0, 280)
          : undefined;

      const row = store.heartbeatBuildTask({
        task_id,
        runner_id,
        progress,
        note,
        now: Date.now(),
      });

      if (!row) {
        return reply
          .status(404)
          .send(apiError(task_id, "NOT_FOUND", "task not found"));
      }

      return {
        task_id: row.task_id,
        status: row.status,
        heartbeat_at: row.heartbeat_at,
        progress: row.progress,
      };
    }
  );

  app.get<{ Querystring: { limit?: string; status?: string; visibility?: string } }>(
    "/v1/build/tasks",
    async (req, reply) => {
      const limitRaw = req.query?.limit;
      const limit = typeof limitRaw === "string" ? Number(limitRaw) : undefined;

      const statusParsed = parseTaskStatus(req.query?.status);
      if (statusParsed === "INVALID") {
        return reply
          .status(400)
          .send(apiError(hexId24(), "BAD_REQUEST", "invalid status"));
      }

      const visibilityParsed = parseTaskVisibility(req.query?.visibility);
      if (visibilityParsed === "INVALID") {
        return reply
          .status(400)
          .send(apiError(hexId24(), "BAD_REQUEST", "invalid visibility"));
      }

      const now = Date.now();
      const rows = store.listBuildTasks({
        limit: clampLimit(limit),
        status: statusParsed,
        visibility: visibilityParsed,
      });

      const items: BuildTaskListItem[] = rows.map((row) => ({
        task_id: row.task_id,
        status: row.status,
        visibility: row.visibility,
        title: row.title,
        created_at: row.created_at,
        updated_at: row.updated_at,
        ...withStale(row, now, staleMs),
      }));

      const hasRunning = items.some((i) => i.status === "running");
      const res: BuildTaskListResponse = {
        server_time_ms: now,
        poll_after_ms: hasRunning ? 1500 : 5000,
        items,
      };
      return res;
    }
  );

  app.get<{ Params: { task_id: string } }>("/v1/build/tasks/:task_id", async (req, reply) => {
    const row = store.getBuildTask(req.params.task_id);
    if (!row) {
      return reply
        .status(404)
        .send(apiError(req.params.task_id, "NOT_FOUND", "task not found"));
    }

    const task_json = row.task_json ? safeJsonParse(row.task_json) : null;
    const result_json = row.result_json ? safeJsonParse(row.result_json) : null;

    // KCA-3.1: hydrate key fields from canonical result_json for convenient polling
    const resultStatus = (result_json as any)?.summary?.status ?? null;
    const trace_id = (result_json as any)?.execution?.trace_id ?? null;
    const diagnostics = (result_json as any)?.diagnostics ?? null;

    const now = Date.now();
    const details: BuildTaskDetailResponse = {
      task_id: row.task_id,
      status: row.status,
      visibility: row.visibility,
      title: row.title,
      created_at: row.created_at,
      updated_at: row.updated_at,
      task_json,
      result_json,
      error_code: row.error_code ?? null,
      error_message: row.error_message ?? null,
      result_status: resultStatus,
      trace_id,
      diagnostics,
      queued_at: row.queued_at ?? null,
      started_at: row.started_at ?? null,
      completed_at: row.completed_at ?? null,
      retry_count: row.retry_count ?? 0,
      executor_target: row.executor_target ?? null,
      executor_id: row.executor_id ?? null,
      last_error: row.last_error ?? null,
      next_retry_at: row.next_retry_at ?? null,
      needs_creator_reason: row.needs_creator_reason ?? null,
      decision_options: row.decision_options ? JSON.parse(row.decision_options) : null,
      resume_token: row.resume_token ?? null,
      creator_decision_status: row.creator_decision_status ?? null,
      creator_decision_at: row.creator_decision_at ?? null,
      ...withStale(row, now, staleMs),
    };
    return details;
  });

  app.post<{ Querystring: { visibility?: string } }>(
    "/v1/build/tasks/sweep-stale",
    async (req, reply) => {
      const now = Date.now();

      const visibilityParsed = parseTaskVisibility(req.query?.visibility);
      if (visibilityParsed === "INVALID") {
        return reply.status(400).send(apiError(hexId24(), "BAD_REQUEST", "invalid visibility"));
      }

      const cutoff = now - staleMs;
      const out = store.sweepStaleRunning({ visibility: visibilityParsed, now, cutoff });

      // KCA-6.3b: Re-dispatch tasks that transitioned to retrying
      for (const task of out.redispatch_tasks) {
        const traceId = hexId24();
        queueMicrotask(() => {
          store.markBuildTaskStarted({
            task_id: task.task_id,
            now: Date.now(),
            executor_target: "auto",
          });
          dispatchBuildTask(JSON.parse(task.task_json) as BuildTask, traceId)
            .then((dispatched) => {
              const finalStatus = dispatched.summary.status as any;
              if (finalStatus === "failed" || finalStatus === "timed_out") {
                handleDispatchFailureWithRetryPolicy(task.task_id, finalStatus, dispatched, traceId);
              } else {
                finalizeDispatchResult(task.task_id, dispatched, traceId);
              }
            })
            .catch((err) => handleDispatchFailureWithRetryPolicy(task.task_id, "failed", err, traceId));
        });
      }

      return { ok: true, now, cutoff, ...out };
    }
  );

  // KCA-6.4: Process scheduled retries
  app.post("/v1/build/tasks/sweep-retry", async (req, reply) => {
    const now = Date.now();
    const retryTasks = store.getScheduledRetryTasks({ now });
    let processed = 0;

    for (const task of retryTasks) {
      const parsedTask = JSON.parse(task.task_json) as BuildTask;
      queueMicrotask(() => {
        store.markBuildTaskStarted({
          task_id: task.task_id,
          now: Date.now(),
          executor_target: "auto",
        });
        dispatchBuildTask(parsedTask, hexId24())
          .then((dispatched) => {
            const finalStatus = dispatched.summary.status as any;
            if (finalStatus === "failed" || finalStatus === "timed_out") {
              handleDispatchFailureWithRetryPolicy(task.task_id, finalStatus, dispatched, hexId24());
            } else {
              finalizeDispatchResult(task.task_id, dispatched, hexId24());
            }
          })
          .catch((err) => handleDispatchFailureWithRetryPolicy(task.task_id, "failed", err, hexId24()));
      });
      processed++;
    }

    return { ok: true, now, processed };
  });

  app.get<{ Querystring: { visibility?: string } }>(
    "/v1/build/tasks/summary",
    async (req, reply) => {
      const now = Date.now();

      const visibilityParsed = parseTaskVisibility(req.query?.visibility);
      if (visibilityParsed === "INVALID") {
        return reply
          .status(400)
          .send(apiError(hexId24(), "BAD_REQUEST", "invalid visibility"));
      }

      const summary = store.getBuildTaskSummary({
        visibility: visibilityParsed,
        now,
        staleMs,
      });

      const { counts, stale_running } = summary;

      let poll_after_ms = 6000;
      if (counts.running > 0) poll_after_ms = stale_running > 0 ? 800 : 1200;
      else if (counts.queued > 0) poll_after_ms = 2500;

      const res: BuildTaskSummaryResponse = {
        server_time_ms: now,
        poll_after_ms,
        stale_running,
        counts,
      };
      return res;
    }
  );

  // KCA-7.2: Creator Decision API
  app.post<{ Params: { task_id: string }; Body: CreatorDecisionRequest }>(
    "/v1/build/tasks/:task_id/creator-decision",
    async (req, reply) => {
      const task_id = req.params.task_id;
      const body = req.body as CreatorDecisionRequest | undefined;

      if (!body || !body.decision) {
        return reply.status(400).send(apiError(hexId24(), "BAD_REQUEST", "decision is required"));
      }

      const validDecisions: Array<"approve_retry" | "cancel_task" | "mark_blocked" | "resume_with_note"> = [
        "approve_retry",
        "cancel_task",
        "mark_blocked",
        "resume_with_note",
      ];
      if (!validDecisions.includes(body.decision)) {
        return reply.status(400).send(apiError(hexId24(), "BAD_REQUEST", "invalid decision"));
      }

      const task = store.getBuildTask(task_id);
      if (!task) {
        return reply.status(404).send(apiError(task_id, "NOT_FOUND", "task not found"));
      }

      if (task.status !== "needs_creator") {
        return reply.status(409).send(apiError(task_id, "STATUS_CONFLICT", "task is not in needs_creator status"));
      }

      if (task.creator_decision_status && task.creator_decision_status !== "pending") {
        return reply.status(409).send(apiError(task_id, "STATUS_CONFLICT", "creator decision already processed"));
      }

      if (body.note && !task.resume_token) {
        return reply.status(400).send(apiError(task_id, "BAD_REQUEST", "resume_token required for note"));
      }

      const now = Date.now();
      let newStatus: string;
      let nextRetryAt: number | null = null;

      if (body.decision === "approve_retry") {
        newStatus = "retrying";
        nextRetryAt = getNextRetryAt(now, (task.retry_count ?? 0) + 1, DEFAULT_BACKOFF_POLICY);
      } else if (body.decision === "cancel_task") {
        newStatus = "cancelled";
      } else if (body.decision === "mark_blocked") {
        newStatus = "blocked";
      } else {
        newStatus = "retrying";
        nextRetryAt = null;
      }

      const updateResult = store.updateBuildTaskCAS({
        task_id,
        expected_version: task.version ?? 0,
        patch: {
          status: newStatus as any,
          creator_decision_status: "approved",
          creator_decision_at: now,
          note: body.note ?? null,
          ...(nextRetryAt ? { next_retry_at: nextRetryAt } : {}),
        },
        now,
      });

      if (updateResult.changed <= 0) {
        return reply.status(409).send(apiError(task_id, "STATUS_CONFLICT", "failed to update task"));
      }

      const mcEvent = createBuildTaskMissionEvent({
        event_type: "build_task.creator_decision",
        task_id,
        status: newStatus,
        decision: body.decision,
        note: body.note,
      });

      void emitMissionControlLiveEvent({
        kind: "approval_resolved",
        severity: mapMissionBuildTaskSeverityToLiveSeverity(mcEvent.severity),
        title: `Creator decision: ${body.decision} for ${task_id}`,
        trace_id: task_id,
        payload: mcEvent,
      });
      appendMissionControlPersistenceFeed(mcEvent as any);
      void deliverBuildTaskMissionEvent(mcEvent);

      const response: CreatorDecisionResponse = {
        task_id,
        status: newStatus as any,
        creator_decision_status: "approved",
        note: body.note ?? null,
      };

      return response;
    }
  );

  // KCA-7.2: Get creator decision status
  app.get<{ Params: { task_id: string } }>(
    "/v1/build/tasks/:task_id/creator-decision",
    async (req, reply) => {
      const task_id = req.params.task_id;

      const task = store.getBuildTask(task_id);
      if (!task) {
        return reply.status(404).send(apiError(task_id, "NOT_FOUND", "task not found"));
      }

      const response: CreatorDecisionResponse = {
        task_id,
        status: task.status as any,
        creator_decision_status: task.creator_decision_status ?? "none",
        note: task.note ?? null,
      };

      return response;
    }
  );

  return app;
}

async function main() {
  const app = await buildServer();
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || "0.0.0.0";

  await app.listen({ port, host });
  app.log.info({ port, host }, "P2/P3 server started");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
