import type { FastifyInstance } from "fastify";
import { isModelAllowed, type TeleGptApiKey } from "../../api-keys/store.js";
import { isIdeReady, listIdeModels } from "../ide-compatibility.js";
import { toOpenAiModelList } from "../adapters/openai-response.js";
import { KIMI_API_MODELS } from "../../providers/kimi_api/index.js";
import { appendEvidenceRecord } from "../../runtime/evidence/execution-evidence-store.js";

const GATEWAY_MODELS = [
  { id: "kimi-k3", owned_by: "telegpt", source: "kimi_api" },
  { id: "kimi-k2.7-code", owned_by: "telegpt", source: "kimi_api" },
];

export function registerModelsRoute(app: FastifyInstance): void {
  app.get("/v1/models", async (req, reply) => {
    const apiKey = (req as any).__apiKey as TeleGptApiKey;

    appendEvidenceRecord({
      evidence_id: `ide.gateway.models.listed-${Date.now()}`,
      trace_id: "ide_gateway",
      job_id: "gateway_models",
      type: "execution_completed" as any,
      timestamp: new Date().toISOString(),
      payload: {
        apiKeyId: apiKey.id,
        clientType: apiKey.clientType,
      },
    }).catch(() => {});

    const allowed = GATEWAY_MODELS.filter((m) => isModelAllowed(apiKey, m.id));

    const ideFiltered = allowed.filter((m) => isIdeReady(m.id, true));

    const response = toOpenAiModelList(
      ideFiltered.map((m) => ({ id: m.id, owned_by: m.owned_by }))
    );

    return reply.send(response);
  });
}
