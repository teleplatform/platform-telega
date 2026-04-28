import type { FastifyInstance } from "fastify";
import { buildPolicyGate } from "../../core/policy/policyGate.js";
import { MemoryCounterStore } from "../../core/limits/memoryStore.js";

export async function registerPolicyGate(app: FastifyInstance) {
  let store: any = new MemoryCounterStore();

  const gate = buildPolicyGate({
    store,
    env: process.env,
    trace: (evt: any) => app.log.info(evt),
  });

  app.addHook("preHandler", gate);
}
