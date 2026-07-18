import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { isModelAllowed, type TeleGptApiKey } from "../../api-keys/store.js";
import { isIdeReady } from "../ide-compatibility.js";
import { openAiToChatRequest, type OpenAiChatRequest } from "../adapters/messages.js";
import { toOpenAiResponse, toOpenAiError } from "../adapters/openai-response.js";
import { routeChat } from "../../core/router.js";
import { ProviderVerification } from "../../core/provider-verification.js";
import { appendEvidenceRecord } from "../../runtime/evidence/execution-evidence-store.js";

export function registerChatCompletionsRoute(app: FastifyInstance): void {
  app.post("/v1/chat/completions", async (req, reply) => {
    const requestId = `req_${randomUUID().slice(0, 12)}`;
    const t0 = Date.now();
    const apiKey = (req as any).__apiKey as TeleGptApiKey;
    const body = req.body as OpenAiChatRequest;

    if (!body || !body.model || !body.messages || !Array.isArray(body.messages)) {
      return reply.code(400).send(toOpenAiError(400, "Invalid request: model and messages are required"));
    }

    if (!isModelAllowed(apiKey, body.model)) {
      return reply.code(403).send(toOpenAiError(403, `Model "${body.model}" is not allowed for this API key`, "permission_denied"));
    }

    if (body.stream) {
      return reply.code(400).send(toOpenAiError(400, "Streaming is not supported in Phase A. Use stream: false.", "not_supported"));
    }

    appendEvidenceRecord({
      evidence_id: `ide.gateway.request.received-${requestId}`,
      trace_id: "ide_gateway",
      job_id: requestId,
      type: "execution_started" as any,
      timestamp: new Date().toISOString(),
      payload: {
        apiKeyId: apiKey.id,
        clientType: apiKey.clientType,
        requestedModel: body.model,
        messageCount: body.messages.length,
        hasTools: !!(body.tools && body.tools.length > 0),
      },
    }).catch(() => {});

    try {
      const chatReq = openAiToChatRequest(body, requestId);

      const verification = ProviderVerification.verify(
        resolveProviderForModel(body.model),
        resolveProviderForModel(body.model),
        body.model
      );

      if (!verification.verified) {
        console.error("[gateway:chat] verification failed", {
          requestId,
          model: body.model,
          reasons: verification.reasons,
        });
      }

      appendEvidenceRecord({
        evidence_id: `ide.gateway.model.resolved-${requestId}`,
        trace_id: "ide_gateway",
        job_id: requestId,
        type: "context_routed" as any,
        timestamp: new Date().toISOString(),
        payload: {
          requestedModel: body.model,
          resolvedProvider: verification.resolvedProvider,
          executionLane: verification.executionLane,
          verificationPassed: verification.verified,
        },
      }).catch(() => {});

      const response = await routeChat(chatReq);

      const openAiResponse = toOpenAiResponse(response, body.model);

      appendEvidenceRecord({
        evidence_id: `ide.gateway.execution.completed-${requestId}`,
        trace_id: "ide_gateway",
        job_id: requestId,
        type: "execution_completed" as any,
        timestamp: new Date().toISOString(),
        payload: {
          requestedModel: body.model,
          resolvedModel: response.model,
          provider: response.meta?.provider,
          executionLane: verification.executionLane,
          latencyMs: Date.now() - t0,
          outputLength: response.output?.length || 0,
          hasToolCalls: !!(response.tool_calls && response.tool_calls.length > 0),
          tokenUsage: response.usage,
          fallbackUsed: response.meta?.fallback_used || false,
        },
      }).catch(() => {});

      return reply.send(openAiResponse);
    } catch (err: any) {
      const latencyMs = Date.now() - t0;
      console.error("[gateway:chat] execution failed", {
        requestId,
        model: body.model,
        error: err.message,
        latencyMs,
      });

      appendEvidenceRecord({
        evidence_id: `ide.gateway.execution.failed-${requestId}`,
        trace_id: "ide_gateway",
        job_id: requestId,
        type: "execution_failed" as any,
        timestamp: new Date().toISOString(),
        payload: {
          requestedModel: body.model,
          error: err.message,
          latencyMs,
        },
      }).catch(() => {});

      return reply.code(500).send(toOpenAiError(500, "Internal gateway error"));
    }
  });
}

function resolveProviderForModel(model: string): string {
  if (model.startsWith("zyloo")) return "zyloo_api";
  if (model.startsWith("kimi")) return "kimi_api";
  if (model.startsWith("glm")) return "glm_api";
  if (model.startsWith("qwen")) return "qwen_api";
  if (model.startsWith("deepseek")) return "deepseek_api";
  if (model.startsWith("openai")) return "openai_api";
  return "kimi_api";
}
