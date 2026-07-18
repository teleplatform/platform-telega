import type { FastifyRequest, FastifyReply } from "fastify";
import { validateApiKey, type TeleGptApiKey } from "../api-keys/store.js";

export async function gatewayAuthMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    reply.code(401).send({
      error: {
        message: "Missing or invalid Authorization header. Expected: Bearer tgpt_sk_...",
        type: "authentication_error",
      },
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  const result = validateApiKey(token);

  if (!result.valid) {
    reply.code(401).send({
      error: {
        message: result.error || "Invalid API key",
        type: "authentication_error",
      },
    });
    return;
  }

  (req as any).__apiKey = result.key;
}
