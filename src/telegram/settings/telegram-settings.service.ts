import type { Context } from "telegraf";
import type {
  ProviderSetting,
  TelegramSessionSettings,
} from "./telegram-settings.types";

type SessionLike = {
  bridge_enabled?: boolean;
  provider?: ProviderSetting;
  creatorMode?: boolean;
  voice_enabled?: boolean;
  language?: "ru";
};

export function getSettingsFromSession(ctx: Context): TelegramSessionSettings {
  const session = (((ctx as any).session || {}) as SessionLike);

  return {
    bridge_enabled: Boolean(session.bridge_enabled),
    provider: session.provider || "auto",
    creatorMode: Boolean(session.creatorMode),
    voice_enabled: Boolean(session.voice_enabled),
    language: session.language || "ru",
  };
}

export function patchSettingsToSession(
  ctx: Context,
  patch: Partial<TelegramSessionSettings>
): TelegramSessionSettings {
  const anyCtx = ctx as any;
  anyCtx.session = anyCtx.session || {};

  Object.assign(anyCtx.session, patch);

  const next = getSettingsFromSession(ctx);

  console.log(
    "[settings] patchSettingsToSession:",
    JSON.stringify({
      patch,
      session: {
        bridge_enabled: next.bridge_enabled,
        provider: next.provider,
        creatorMode: next.creatorMode,
        voice_enabled: next.voice_enabled,
        language: next.language,
      },
    })
  );

  return next;
}
