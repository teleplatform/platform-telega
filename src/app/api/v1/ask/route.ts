import { NextResponse } from "next/server";
import { resolveProviderForLane, resolveModelForProvider } from "@/core/providers/providerRouter";
import { localChatCompletion } from "@/core/providers/localOpenAI";
import { writeTrace } from "@/core/traces/writeTrace";
import { agentAnswerV1 } from "@/core/agent/agentAnswerV1";
import { actionabilityGateV1 } from "@/core/g2f/actionabilityGateV1";
import { createBuildTask } from "@/core/g2f/createBuildTask";
import { db } from "@/core/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const input = String(body?.input || "");
  const lane = (body?.lane || "smart") as "cheap" | "smart" | "coding";
  const mode = String(body?.mode || body?.business_mode || "");
  const uiMode = String(body?.ui_mode || body?.user_mode || body?.tele_mode || "public");
  const g2fParam = String(body?.g2f || "");
  const g2f =
    g2fParam === "auto" || g2fParam === "off"
      ? g2fParam
      : uiMode === "maker"
        ? "auto"
        : "off";
  const knowledge_pack_id = String(body?.knowledge_pack_id || "");

  const provider = resolveProviderForLane(lane);
  const model = resolveModelForProvider(provider, lane);

  const startedAt = Date.now();

  try {
    if (mode === "agent") {
      if (!knowledge_pack_id) {
        return NextResponse.json(
          { ok: false, provider: "local", error: "missing_knowledge_pack_id" },
          { status: 400 }
        );
      }
      const res = await agentAnswerV1({ input, knowledge_pack_id });
      const gate = actionabilityGateV1(input, res.output);
      let generatedTaskId: string | null = null;

      if (g2f === "auto" && gate.ok && gate.task_kind && gate.task_title && gate.task_prompt) {
        const task = await createBuildTask({
          kind: gate.task_kind,
          title: gate.task_title,
          prompt: gate.task_prompt,
          artifacts_expected: gate.artifacts_expected,
          source: { route: "/v1/ask" },
        });
        generatedTaskId = task.id;
      }
      const latency_ms = Date.now() - startedAt;

      const trace_id = await writeTrace({
        ok: true,
        route: "/v1/ask",
        provider: "local",
        lane: res.lane,
        model,
        latency_ms,
        tokens_in: res.usage?.prompt_tokens,
        tokens_out: res.usage?.completion_tokens,
        tokens_total: res.usage?.total_tokens,
        intent: res.intent,
        intent_source: res.intent_source,
        intent_reason: res.intent_reason,
        intent_confidence: res.intent_confidence,
        fallback_used: res.fallback_used,
        failures_count: res.failures_count,
        timeouts: res.timeouts,
        max_tokens: res.max_tokens,
        knowledge_source: res.knowledge_source,
        knowledge_version: res.knowledge_version,
        knowledge_etag: res.knowledge_etag,
        knowledge_pack_id: knowledge_pack_id,
        generated_task_id: generatedTaskId ?? undefined,
        actionability_score: gate.score,
        gate_reason: gate.reason,
        artifacts_count: generatedTaskId ? 0 : null,
        meta: {
          input,
          output: res.output,
          force_provider: process.env.TRACES_FORCE_PROVIDER === "true",
        },
      });

      if (generatedTaskId) {
        db.tasks.setSourceTrace({ id: generatedTaskId, source_trace_id: trace_id });
      }

      return NextResponse.json({
        ok: true,
        provider: "local",
        lane: res.lane,
        model,
        output: res.output,
        intent: res.intent,
        intent_source: res.intent_source,
        intent_reason: res.intent_reason,
        intent_confidence: res.intent_confidence,
        fallback_used: res.fallback_used,
        failures_count: res.failures_count,
        timeouts: res.timeouts,
        max_tokens: res.max_tokens,
        knowledge_source: res.knowledge_source,
        knowledge_version: res.knowledge_version,
        knowledge_etag: res.knowledge_etag,
        generated_task_id: generatedTaskId,
        actionability_score: gate.score,
        gate_reason: gate.reason,
        usage: res.usage ?? null,
        latency_ms,
        trace_id,
      });
    }

    const result = await localChatCompletion({
      model,
      messages: [{ role: "user", content: input }],
      temperature: body?.temperature,
      max_tokens: body?.max_tokens,
    });

    const latency_ms = Date.now() - startedAt;

    const trace_id = await writeTrace({
      ok: true,
      route: "/v1/ask",
      provider: "local",
      lane,
      model,
      latency_ms,
      tokens_in: result.usage?.prompt_tokens,
      tokens_out: result.usage?.completion_tokens,
      tokens_total: result.usage?.total_tokens,
      meta: {
        input,
        output: result.text,
        force_provider: process.env.TRACES_FORCE_PROVIDER === "true",
      },
    });

    return NextResponse.json({
      ok: true,
      provider: "local",
      lane,
      model,
      output: result.text,
      usage: result.usage ?? null,
      latency_ms,
      trace_id,
    });
  } catch (e: any) {
    const latency_ms = Date.now() - startedAt;

    const trace_id = await writeTrace({
      ok: false,
      route: "/v1/ask",
      provider: "local",
      lane,
      model,
      latency_ms,
      error: e?.message || "ask_failed",
      intent: mode === "agent" ? "unknown" : undefined,
      intent_source: mode === "agent" ? "llm" : undefined,
      intent_reason: mode === "agent" ? "error" : undefined,
      intent_confidence: mode === "agent" ? 0 : undefined,
      fallback_used: false,
      failures_count: 1,
      timeouts: 0,
      max_tokens: body?.max_tokens,
      knowledge_source: mode === "agent" ? "none" : undefined,
      knowledge_version: null,
      knowledge_etag: null,
      knowledge_pack_id: knowledge_pack_id || undefined,
      actionability_score: mode === "agent" ? 0 : undefined,
      gate_reason: mode === "agent" ? "error" : undefined,
      artifacts_count: mode === "agent" ? 0 : undefined,
      meta: {
        input,
        force_provider: process.env.TRACES_FORCE_PROVIDER === "true",
      },
    });

    return NextResponse.json(
      { ok: false, provider: "local", error: e?.message || "ask_failed", trace_id },
      { status: 500 }
    );
  }
}
