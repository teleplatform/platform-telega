import Fastify from "fastify";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
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
} from "../types/api.js";
import type { BuildResult, BuildTask } from "../types/telecore.js";

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
  if (v === "queued" || v === "running" || v === "done" || v === "partial" || v === "blocked") {
    return v;
  }
  return "INVALID";
}

function parseTaskVisibility(v: unknown) {
  if (typeof v !== "string") return undefined;
  if (v === "public" || v === "creator" || v === "core") return v;
  return "INVALID";
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

  app.get("/health", async () => {
    return { ok: true };
  });

  // KB-2: GET knowledge pack
  app.get<{ Params: { business_id: string } }>(
    "/v1/knowledge/:business_id",
    async (req, reply) => {
      const business_id = req.params.business_id;
      const pack = store.getKnowledgePack(business_id);
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

      const result = store.putKnowledgePack({
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

    const dbPack = store.getKnowledgePack(business_id);
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
      body.meta?.task_id && body.meta.task_id !== "auto"
        ? body.meta.task_id
        : hexId24();

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
    });

    return { task_id, status: "queued" };
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
      if (status !== "done" && status !== "partial" && status !== "blocked") {
        return reply
          .status(400)
          .send(apiError(t, "BAD_REQUEST", "invalid status"));
      }

      if (body.summary?.task_id && body.summary.task_id !== task_id) {
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

      // P11: запрет регрессии терминальных статусов
      const terminal = new Set(["done", "partial", "blocked"]);
      if (terminal.has(task.status)) {
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

      return { ok: true, now, cutoff, ...out };
    }
  );

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
