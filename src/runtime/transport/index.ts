// ─────────────────────────────────────────────────────────────
// TRANSPORT LAYER INDEX
//
// Strict transport binding layer. NO business logic.
// Binds surfaces (Telegram, Web, Alice, API) → chat-surface.
//
// Principles:
// - ONE unified contract
// - ZERO surface-owned business logic
// - adapters are dumb bridges
// ─────────────────────────────────────────────────────────────

export * from "./transport.types.js";

export { normalizeTelegramUpdate, normalizeTelegramCallback } from "./telegram/telegram-input-normalizer.js";
export { deliverTransportOutput, buildTelegramKeyboard } from "./telegram/telegram-output-delivery.js";
export { extractTelegramAction, extractTelegramActionUserId, handleTelegramCallback } from "./telegram/telegram-action-binding.js";
export { handleTelegramUpdate, handleTelegramCallbackQuery, bindTelegramBot } from "./telegram/telegram-binding.js";

export const TRANSPORT_VERSION = "v1";