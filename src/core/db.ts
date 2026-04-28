import crypto from "node:crypto";
import path from "node:path";
import { initSqlite } from "../server/storage/sqlite.ts";

let store: ReturnType<typeof initSqlite> | null = null;

function getStore() {
  if (!store) {
    const dataDir = process.env.TELEGPT_DATA_DIR ?? ".data";
    const dbPath = path.join(dataDir, "tele-gpt.sqlite");
    store = initSqlite(dbPath);
  }
  return store;
}

export const db = {
  traces: {
    insert(input: {
      ok: boolean;
      route: string;
      provider: string;
      lane?: string;
      model?: string;
      latency_ms?: number;
      tokens_in?: number;
      tokens_out?: number;
      tokens_total?: number;
      error?: string;
      intent?: string;
      intent_source?: string;
      intent_reason?: string;
      fallback_used?: boolean;
      failures_count?: number;
      timeouts?: number;
      max_tokens?: number;
      knowledge_source?: string;
      knowledge_version?: number | string;
      knowledge_etag?: string;
      knowledge_pack_id?: string;
      generated_task_id?: string;
      actionability_score?: number;
      gate_reason?: string;
      artifacts_count?: number;
      intent_confidence?: number;
      skill_id?: string;
      skill_stage?: string;
      issues_count?: number;
      patch_bytes?: number;
      maker_mode?: boolean;
      duration_sec?: number;
      validators_mp4_exists?: boolean;
      validators_duration_ok?: boolean;
      validators_aspect_9x16?: boolean;
      validators_audio_present?: boolean;
      lrl_event_type?: string;
      lrl_event_id?: string;
      award_teleton?: number;
      award_bonus?: number;
      wallet_teleton_delta_applied?: number;
      wallet_bonus_delta_applied?: number;
      fraud_flags_count?: number;
      action_map_id?: string;
      meta?: Record<string, any>;
      message?: string;
      reply?: string;
    }) {
      const traceId = crypto.randomUUID();
      const now = Date.now();
      const message = input.message ?? `[${input.route}] ${input.meta?.input ?? ""}`.trim();
      const reply = input.reply ?? String(input.meta?.output ?? "");
      const provider = input.provider;

      getStore().insertTrace({
        trace_id: traceId,
        message: message || "(empty)",
        reply,
        mode: "openai",
        provider,
        model: input.model,
        created_at: now,
        ok: input.ok ? 1 : 0,
        latency_ms: input.latency_ms,
        tokens_in: input.tokens_in,
        tokens_out: input.tokens_out,
        error_message: input.error,
        lane: input.lane ?? null,
        intent: input.intent ?? null,
        intent_source: input.intent_source ?? null,
        intent_reason: input.intent_reason ?? null,
        intent_confidence: typeof input.intent_confidence === "number" ? input.intent_confidence : null,
        fallback_used: typeof input.fallback_used === "boolean" ? (input.fallback_used ? 1 : 0) : null,
        failures_count: typeof input.failures_count === "number" ? input.failures_count : null,
        timeouts: typeof input.timeouts === "number" ? input.timeouts : null,
        max_tokens: typeof input.max_tokens === "number" ? input.max_tokens : null,
        knowledge_source: input.knowledge_source ?? null,
        knowledge_business_id: input.knowledge_pack_id ?? null,
        knowledge_version: input.knowledge_version ?? null,
        knowledge_etag: input.knowledge_etag ?? null,
        generated_task_id: input.generated_task_id ?? null,
        actionability_score: typeof input.actionability_score === "number" ? input.actionability_score : null,
        gate_reason: input.gate_reason ?? null,
        artifacts_count: typeof input.artifacts_count === "number" ? input.artifacts_count : null,
        skill_id: input.skill_id ?? null,
        skill_stage: input.skill_stage ?? null,
        issues_count: typeof input.issues_count === "number" ? input.issues_count : null,
        patch_bytes: typeof input.patch_bytes === "number" ? input.patch_bytes : null,
        maker_mode: typeof input.maker_mode === "boolean" ? (input.maker_mode ? 1 : 0) : null,
        duration_sec: typeof input.duration_sec === "number" ? input.duration_sec : null,
        validators_mp4_exists: typeof input.validators_mp4_exists === "boolean"
          ? input.validators_mp4_exists
            ? 1
            : 0
          : null,
        validators_duration_ok: typeof input.validators_duration_ok === "boolean"
          ? input.validators_duration_ok
            ? 1
            : 0
          : null,
        validators_aspect_9x16: typeof input.validators_aspect_9x16 === "boolean"
          ? input.validators_aspect_9x16
            ? 1
            : 0
          : null,
        validators_audio_present: typeof input.validators_audio_present === "boolean"
          ? input.validators_audio_present
            ? 1
            : 0
          : null,
        lrl_event_type: input.lrl_event_type ?? null,
        lrl_event_id: input.lrl_event_id ?? null,
        award_teleton: typeof input.award_teleton === "number" ? input.award_teleton : null,
        award_bonus: typeof input.award_bonus === "number" ? input.award_bonus : null,
        wallet_teleton_delta_applied:
          typeof input.wallet_teleton_delta_applied === "number"
            ? input.wallet_teleton_delta_applied
            : null,
        wallet_bonus_delta_applied:
          typeof input.wallet_bonus_delta_applied === "number"
            ? input.wallet_bonus_delta_applied
            : null,
        fraud_flags_count:
          typeof input.fraud_flags_count === "number" ? input.fraud_flags_count : null,
        action_map_id: input.action_map_id ?? null,
      });

      return traceId;
    },
    list(input?: { limit?: number; route?: string }) {
      const limit = input?.limit ?? 20;
      const route = input?.route;
      const items = getStore().listHistory({ limit }) as Array<{
        trace_id: string;
        message: string;
        reply: string;
        provider: "local" | "openai";
        model?: string;
        created_at: number;
        ok: 1 | 0;
        latency_ms?: number;
        tokens_in?: number;
        tokens_out?: number;
      }>;
      if (!route) return items;
      return items.filter((t) => t.message.startsWith(`[${route}]`));
    },
    get(trace_id: string) {
      return getStore().getTrace(trace_id) as
        | {
            trace_id: string;
            message: string;
            reply: string;
            mode: string;
            provider: string;
            model?: string;
            created_at: number;
            ok: 1 | 0;
            latency_ms?: number;
            tokens_in?: number;
            tokens_out?: number;
            error_message?: string;
            lane?: string | null;
            intent?: string | null;
            intent_source?: string | null;
            intent_reason?: string | null;
            fallback_used?: number | null;
            failures_count?: number | null;
            timeouts?: number | null;
            max_tokens?: number | null;
            knowledge_source?: string | null;
            knowledge_version?: number | string | null;
            knowledge_etag?: string | null;
            intent_confidence?: number | null;
            skill_id?: string | null;
            skill_stage?: string | null;
            issues_count?: number | null;
            patch_bytes?: number | null;
            maker_mode?: number | null;
            duration_sec?: number | null;
            validators_mp4_exists?: number | null;
            validators_duration_ok?: number | null;
            validators_aspect_9x16?: number | null;
            validators_audio_present?: number | null;
            lrl_event_type?: string | null;
            lrl_event_id?: string | null;
            award_teleton?: number | null;
            award_bonus?: number | null;
            wallet_teleton_delta_applied?: number | null;
            wallet_bonus_delta_applied?: number | null;
            fraud_flags_count?: number | null;
            action_map_id?: string | null;
          }
        | undefined;
    },
    deleteBefore(cutoffMs: number) {
      return getStore().deleteTracesBefore(cutoffMs);
    },
  },
  lrl: {
    getWallet(user_id: string) {
      return getStore().getWallet(user_id) as
        | {
            user_id: string;
            teleton_balance: number;
            bonus_points_balance: number;
            updated_at: string;
          }
        | undefined;
    },
    upsertWallet(input: { user_id: string; teleton_balance: number; bonus_points_balance: number; updated_at: string }) {
      getStore().upsertWallet(input);
    },
    insertLedger(input: {
      id: string;
      user_id: string;
      asset: string;
      delta: number;
      reason: string;
      event_id: string;
      created_at: string;
    }) {
      getStore().insertLedger(input);
    },
    listLedger(input: { user_id: string; limit: number }) {
      return getStore().listLedger(input);
    },
    sumLedgerForDay(input: { user_id: string; asset: string; dayIso: string }) {
      return getStore().sumLedgerForDay(input);
    },
    insertEvent(input: {
      id: string;
      type: string;
      user_id: string;
      payload_json: string;
      payload_hash: string;
      status: string;
      blocked_reason?: string | null;
      created_at: string;
    }) {
      getStore().insertLrlEvent(input);
    },
    listQueuedEvents(limit: number) {
      return getStore().listQueuedLrlEvents(limit);
    },
    updateEventStatus(input: {
      id: string;
      status: string;
      blocked_reason?: string | null;
      processed_at?: string | null;
    }) {
      getStore().updateLrlEventStatus(input);
    },
    listRules() {
      return getStore().listLrlRules();
    },
    listRulesByType(event_type: string) {
      return getStore().listLrlRulesByType(event_type);
    },
    insertRule(input: {
      id: string;
      version: number;
      enabled: number;
      event_type: string;
      award_teleton: number;
      award_bonus: number;
      daily_cap_teleton: number;
      daily_cap_bonus: number;
      conditions_json: string;
      updated_at: string;
    }) {
      getStore().insertLrlRule(input);
    },
    insertReviewGate(input: { review_id: string; stars: number; visibility: string; created_at: string }) {
      getStore().insertReviewGate(input);
    },
    getEvent(id: string) {
      return getStore().getLrlEvent(id) as
        | {
            id: string;
            type: string;
            user_id: string;
            payload_json: string;
            payload_hash: string;
            status: string;
            blocked_reason?: string | null;
            created_at: string;
            processed_at?: string | null;
          }
        | undefined;
    },
  },
  kb: {
    get(key: string) {
      return getStore().getKbEntry(key) as
        | {
            key: string;
            payload_json: string;
            version: number;
            etag: string;
            updated_at: string;
            created_at: string;
          }
        | undefined;
    },
    putCAS(input: { key: string; payload_json: string; if_match_etag?: string }) {
      const now = new Date().toISOString();
      const res = getStore().putKbEntryCas({
        key: input.key,
        payload_json: input.payload_json,
        if_match_etag: input.if_match_etag,
        now,
      });
      return res;
    },
  },
  tasks: {
    create(input?: { title?: string; visibility?: "public" | "creator" | "core"; task_json?: string }) {
      const task_id = crypto.randomUUID();
      const now = Date.now();
      getStore().upsertBuildTask({
        task_id,
        status: "queued",
        visibility: input?.visibility ?? "public",
        title: input?.title ?? "Task",
        created_at: now,
        updated_at: now,
        task_json: input?.task_json ?? "{}",
      });
      return { id: task_id };
    },
    get(task_id: string) {
      return getStore().getBuildTask(task_id) as
        | {
            task_id: string;
            status: string;
            runner_id?: string | null;
            heartbeat_at?: number | null;
            blocked_reason?: string | null;
            version?: number;
            task_json?: string | null;
            result_json?: string | null;
            source_trace_id?: string | null;
          }
        | undefined;
    },
    setSourceTrace(input: { id: string; source_trace_id: string }) {
      getStore().setBuildTaskSourceTrace({
        task_id: input.id,
        source_trace_id: input.source_trace_id,
      });
    },
    listQueued(input?: { limit?: number }) {
      const limit = input?.limit ?? 20;
      return getStore().listBuildTasks({ status: "queued", limit }) as Array<{
        task_id: string;
        status: string;
        visibility: string;
        title: string;
        created_at: number;
        updated_at: number;
      }>;
    },
    list(input?: { limit?: number; status?: string; visibility?: string }) {
      const limit = input?.limit ?? 50;
      return getStore().listBuildTasks({
        limit,
        status: input?.status as any,
        visibility: input?.visibility as any,
      }) as Array<{
        task_id: string;
        status: string;
        visibility: string;
        title: string;
        created_at: number;
        updated_at: number;
        heartbeat_at?: number | null;
        progress?: number | null;
      }>;
    },
    updateCAS(input: {
      id: string;
      expectedVersion: number;
      patch: {
        status?: "queued" | "running" | "done" | "partial" | "blocked";
        heartbeat_at?: string;
        runner_id?: string | null;
        blocked_reason?: string | null;
      };
    }) {
      const now = Date.now();
      const heartbeat_at = input.patch.heartbeat_at
        ? Date.parse(input.patch.heartbeat_at)
        : undefined;
      const res = getStore().updateBuildTaskCAS({
        task_id: input.id,
        expected_version: input.expectedVersion,
        patch: {
          status: input.patch.status,
          runner_id: input.patch.runner_id ?? undefined,
          heartbeat_at,
          blocked_reason: input.patch.blocked_reason ?? undefined,
        },
        now,
      });
      return { ok: res.changed > 0 };
    },
    setResult(input: {
      id: string;
      status: "done" | "partial" | "blocked";
      result_json: string;
      error_code?: string | null;
      error_message?: string | null;
    }) {
      const now = Date.now();
      const ok = getStore().setBuildResult({
        task_id: input.id,
        status: input.status,
        result_json: input.result_json,
        updated_at: now,
        error_code: input.error_code ?? null,
        error_message: input.error_message ?? null,
      });
      return { ok };
    },
    listStaleRunning(input: { cutoffIso: string }) {
      const cutoff = Date.parse(input.cutoffIso);
      const items = getStore().listStaleRunningTasks({ cutoff });
      return items.map((t) => ({
        id: t.task_id,
        version: t.version,
      }));
    },
    setHeartbeatStale(input: { id: string; secondsAgo: number }) {
      const now = Date.now();
      const at = now - input.secondsAgo * 1000;
      const res = getStore().setHeartbeatStale({
        task_id: input.id,
        at,
        now,
      });
      return { ok: res.changed > 0 };
    },
  },
  taskArtifacts: {
    insert(input: {
      id: string;
      task_id: string;
      name: string;
      mime: string;
      path: string;
      bytes: number;
      created_at: number;
    }) {
      getStore().insertTaskArtifact(input);
    },
    list(task_id: string) {
      return getStore().listTaskArtifacts(task_id) as Array<{
        id: string;
        task_id: string;
        name: string;
        mime: string;
        path: string;
        bytes: number;
        created_at: number;
      }>;
    },
    get(id: string) {
      return getStore().getTaskArtifact(id) as
        | {
            id: string;
            task_id: string;
            name: string;
            mime: string;
            path: string;
            bytes: number;
            created_at: number;
          }
        | undefined;
    },
  },
};
