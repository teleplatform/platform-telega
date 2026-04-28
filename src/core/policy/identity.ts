import type { FastifyRequest } from "fastify";

export type Identity = {
  kind: "api" | "telegram" | "unknown";
  id: string; // stable string key
};

export function getIdentity(req: FastifyRequest, clientIdHeader = "x-telegpt-client-id"): Identity {
  // 1) explicit client id (best)
  const h = req.headers[clientIdHeader] as string | undefined;
  if (h && h.trim()) return { kind: "api", id: `api:${h.trim()}` };

  // 2) telegram bridge can pass tg user id in header (if you already do)
  const tg = req.headers["x-telegram-user-id"] as string | undefined;
  if (tg && tg.trim()) return { kind: "telegram", id: `tg:${tg.trim()}` };

  // 3) fallback: IP
  const ip = req.ip || (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  if (ip) return { kind: "unknown", id: `ip:${ip}` };

  return { kind: "unknown", id: "unknown:unknown" };
}