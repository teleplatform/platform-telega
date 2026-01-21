export type TeleMode = "public" | "maker";

export type TeleDebug = {
  provider: "ollama";
  latency_ms: number;
  warnings?: string[];
  raw?: string;
};

export type TeleOk<T extends object> = {
  ok: true;
  model: string;
  tagUsed: string;
} & T & { debug?: TeleDebug };

export type TeleFail = {
  ok: false;
  error: string;
  message?: string;
  model?: string;
  tagUsed?: string;
  debug?: TeleDebug;
};

export function ok<T extends object>(
  base: { model: string; tagUsed: string },
  payload: T,
  mode: TeleMode,
  debug?: TeleDebug
): TeleOk<T> {
  if (mode !== "maker") return { ok: true, ...base, ...payload };
  return { ok: true, ...base, ...payload, debug };
}

export function fail(
  error: string,
  opts?: {
    message?: string;
    model?: string;
    tagUsed?: string;
    mode?: TeleMode;
    debug?: TeleDebug;
  }
): TeleFail {
  const mode = opts?.mode ?? "public";

  const base: TeleFail = {
    ok: false,
    error,
    message: opts?.message,
    model: opts?.model,
    tagUsed: opts?.tagUsed,
  };

  if (mode !== "maker") return base;
  return { ...base, debug: opts?.debug };
}
