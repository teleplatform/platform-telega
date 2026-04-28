import type { FastifyInstance } from "fastify";
import { registerAliceChannel } from "./alice-adapter.js";
import { registerTelegramChannel } from "./telegram-adapter.js";

export async function registerChannelRoutes(app: FastifyInstance) {
  await registerAliceChannel(app);
  await registerTelegramChannel(app);
  console.log("[channels] Alice and Telegram adapters registered");
}

export type { UnifiedInboundEvent, UnifiedOutboundEvent, Channel } from "./unified-event.js";
