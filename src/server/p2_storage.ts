import Fastify from "fastify";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ChatRequest, ChatResponse } from "../types/chat.ts";
import { routeChat } from "../core/router.ts";
import { initSqlite } from "./storage/sqlite.ts";
import { chooseProvider } from "./provider/strategy.ts";
import { guardCreatorOnlyBaseUrl } from "./env/guard.ts";
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
} from "../types/api.ts";
import type { BuildResult, BuildTask } from "../types/telecore.ts";

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

  app.get("/health", async () => {
    return { ok: true };
  });

  app.post<{ Body: AskRequest }>("/v1/ask", async (req, reply) => {
    const t = hexId24();
    const msg = (req.body?.message ?? "").trim();
    const user_id =
      typeof req.body?.user_id === "string" ? req.body.user_id : undefined;

    if (!msg) {
      return reply.status(400).send(apiError(t, "BAD_REQUEST", "message is required"));
    }

    const start = Date.now();

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
    const choice = chooseProvider({
      requested_model: req.body?.model,
      has_openai_key: Boolean(apiKey),
      has_local_base_url: Boolean(localBase),
      local_default_model: localModel,
    });
    const model = choice.model;

    let out: ChatResponse | null = null;
    let provider: "local" | "openai" = choice.provider;
    let mode: AskResponse["mode"] = "echo";
    let replyText = "";
    let ok: 1 | 0 = 1;
    let error_code: ApiErrorCode | undefined;
    let error_message: string | undefined;
    let tokens_in: number | undefined;
    let tokens_out: number | undefined;
    let cost_usd: number | undefined;

    try {
      out = await routeChat({
        message: msg,
        model,
        request_id: t,
      } as ChatRequest);

      provider = (out.meta?.provider ?? choice.provider) as "local" | "openai";
      mode = provider === "openai" ? "openai" : "echo";
      replyText = out.output ?? "";
      tokens_in = out.meta?.usage?.tokens_in;
      tokens_out = out.meta?.usage?.tokens_out;
      cost_usd = out.meta?.usage?.cost_usd;
    } catch (_err) {
      ok = 0;
      error_code = "UPSTREAM_ERROR";
      error_message = "upstream error";
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
    });

    if (ok === 0) {
      return reply.status(502).send(apiError(t, "UPSTREAM_ERROR", "upstream error"));
    }

    const res: AskResponse = {
      trace_id: t,
      reply: replyText,
      mode,
      meta: {
        provider,
        model,
        duration_ms,
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

      const ok = store.setBuildResult({
        task_id,
        status,
        result_json: JSON.stringify(body),
        updated_at: Date.now(),
      });

      if (!ok) {
        return reply
          .status(404)
          .send(apiError(task_id, "NOT_FOUND", "task not found"));
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
