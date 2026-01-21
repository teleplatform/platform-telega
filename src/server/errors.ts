export type ErrorKind =
  | "rate_limit"
  | "overloaded"
  | "upstream"
  | "timeout"
  | "bad_request"
  | "auth"
  | "internal"
  | "shutdown";

export type ProviderName = "openai" | "local";

export type NormalizedError = {
  status: number;
  code: string;
  kind: ErrorKind;
  message: string;
  retryable: boolean;
  provider?: ProviderName;
  provider_error?: {
    code?: string;
    type?: string;
    message?: string;
    status?: number;
  };
};

function pickString(v: unknown): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}

function pickNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/**
 * Normalize unknown error into stable taxonomy.
 * NOTE: keep it conservative; add cases only when observed.
 */
export function normalizeError(
  err: unknown,
  requestId: string,
  hint?: { provider?: ProviderName }
): NormalizedError {
  const anyErr = err as any;

  const statusCode =
    pickNumber(anyErr?.statusCode) ??
    pickNumber(anyErr?.status) ??
    undefined;

  const msg =
    pickString(anyErr?.message) ??
    pickString(anyErr?.error?.message) ??
    "Unexpected error";

  const oaStatus = pickNumber(anyErr?.response?.status) ?? pickNumber(anyErr?.status);
  const oaBody = anyErr?.response?.data ?? anyErr?.data ?? anyErr?.error;

  const oaType =
    pickString(oaBody?.error?.type) ??
    pickString(oaBody?.type) ??
    pickString(anyErr?.type);

  const oaCode =
    pickString(oaBody?.error?.code) ??
    pickString(oaBody?.code);

  const provider = hint?.provider;

  const name = pickString(anyErr?.name);
  const code = pickString(anyErr?.code);

  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT" || name === "AbortError") {
    return {
      status: 504,
      code: "TELEGPT_TIMEOUT",
      kind: "timeout",
      message: "Upstream timeout",
      retryable: true,
      provider,
      provider_error: {
        code,
        type: name,
        message: msg,
      },
    };
  }

  const s = oaStatus ?? statusCode;
  if (s === 429) {
    return {
      status: 429,
      code: "TELEGPT_RATE_LIMIT",
      kind: "rate_limit",
      message: "Rate limited",
      retryable: true,
      provider,
      provider_error: {
        status: s,
        code: oaCode,
        type: oaType,
        message: pickString(oaBody?.error?.message) ?? msg,
      },
    };
  }

  if (s === 401 || s === 403) {
    return {
      status: s,
      code: "TELEGPT_AUTH",
      kind: "auth",
      message: "Unauthorized",
      retryable: false,
      provider,
      provider_error: {
        status: s,
        code: oaCode,
        type: oaType,
        message: pickString(oaBody?.error?.message) ?? msg,
      },
    };
  }

  if (s === 400 || s === 422) {
    return {
      status: s,
      code: "TELEGPT_BAD_REQUEST",
      kind: "bad_request",
      message: "Bad request",
      retryable: false,
      provider,
      provider_error: {
        status: s,
        code: oaCode,
        type: oaType,
        message: pickString(oaBody?.error?.message) ?? msg,
      },
    };
  }

  if (typeof s === "number" && s >= 500 && s <= 599) {
    return {
      status: 502,
      code: "TELEGPT_UPSTREAM",
      kind: "upstream",
      message: "Upstream error",
      retryable: true,
      provider,
      provider_error: {
        status: s,
        code: oaCode,
        type: oaType,
        message: pickString(oaBody?.error?.message) ?? msg,
      },
    };
  }

  return {
    status: 500,
    code: "TELEGPT_INTERNAL",
    kind: "internal",
    message: "Internal error",
    retryable: false,
    provider,
    provider_error: {
      code,
      type: name,
      message: msg,
      status: typeof s === "number" ? s : undefined,
    },
  };
}
