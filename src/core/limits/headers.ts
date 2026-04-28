import type { FastifyReply } from "fastify";

export function setRateHeaders(reply: FastifyReply, limit: number, remaining: number, reset_s: number) {
  reply.header("x-rate-limit-limit", String(limit));
  reply.header("x-rate-limit-remaining", String(Math.max(0, remaining)));
  reply.header("x-rate-limit-reset-s", String(reset_s));
}

export function setQuotaHeaders(reply: FastifyReply, limit: number, remaining: number, reset_s: number) {
  reply.header("x-quota-limit", String(limit));
  reply.header("x-quota-remaining", String(Math.max(0, remaining)));
  reply.header("x-quota-reset-s", String(reset_s));
}