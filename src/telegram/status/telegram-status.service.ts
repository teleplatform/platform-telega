import type { Context } from "telegraf";
import type { TelegramRuntimeStatus } from "./telegram-status.types";

type SessionLike = {
  provider?: string;
  bridge_enabled?: boolean;
  creatorMode?: boolean;
  voice_enabled?: boolean;
  runtime_status?: Partial<TelegramRuntimeStatus>;
};

export function getRuntimeStatus(ctx: Context): TelegramRuntimeStatus {
  const session = (((ctx as any).session || {}) as SessionLike);

  return {
    forcedProvider: session.provider || "auto",
    effectiveProvider: session.runtime_status?.effectiveProvider || "unknown",
    bridge_enabled: Boolean(session.bridge_enabled),
    creatorMode: Boolean(session.creatorMode),
    voice_enabled: Boolean(session.voice_enabled),
    lastFallback: Boolean(session.runtime_status?.lastFallback),
    lastError: session.runtime_status?.lastError || undefined,
    lastWhy: session.runtime_status?.lastWhy || undefined,
  };
}

export function updateRuntimeStatus(
  ctx: Context,
  patch: Partial<TelegramRuntimeStatus>
): TelegramRuntimeStatus {
  const anyCtx = ctx as any;
  anyCtx.session = anyCtx.session || {};
  anyCtx.session.runtime_status = {
    ...(anyCtx.session.runtime_status || {}),
    ...patch,
  };

  return getRuntimeStatus(ctx);
}
