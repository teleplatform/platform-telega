import { listModels } from "../../core/models.js";
import { ok, fail } from "../llm/contract.js";

const ASSIGNED = {
  translate: "translategemma:en",
  chat: "deepseek-r1:1.5b",
};

export async function registerModelsRoute(server: any) {
  server.get("/models", async (_req: any, reply: any) => {
    try {
      const models = await listModels();
      return reply.send(
        ok(
          { model: "system", tagUsed: "models" },
          { models, assigned: ASSIGNED },
          "public"
        )
      );
    } catch (e: any) {
      return reply.send(fail("models_failed", { message: e?.message ?? "unknown" }));
    }
  });
}
