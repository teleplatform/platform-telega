/**
 * Kozy Local XTTS Provider — bounded, minimal, production-safe.
 *
 * Calls the already-running Kozy voice runtime on this Mac
 * via its HTTP endpoint (default: http://127.0.0.1:8010).
 *
 * Does NOT reimplement TTS. Reuses existing Kozy server as source of truth.
 */

const KOZY_BASE_URL = process.env.KOZY_SERVER_URL ?? "http://127.0.0.1:8010";

export interface KozySynthesizeInput {
  text: string;
  lang?: string;
  speed?: number;
  ref?: string;
  filename?: string;
  trace_id?: string;
}

export interface KozySynthesizeResult {
  ok: boolean;
  provider: "kozy";
  file?: string;
  filename?: string;
  size_bytes?: number;
  latency_sec?: number;
  error?: string;
}

function isEnabled(): boolean {
  return (process.env.KOZY_ENABLED ?? "true") === "true";
}

function validateInput(input: KozySynthesizeInput): string | null {
  if (!input.text || !input.text.trim()) {
    return "text is required and must be non-empty";
  }

  if (input.text.length > 5000) {
    return "text exceeds 5000 character limit";
  }

  if (input.speed !== undefined && (input.speed < 0.25 || input.speed > 3.0)) {
    return "speed must be between 0.25 and 3.0";
  }

  return null;
}

export async function kozySynthesize(
  input: KozySynthesizeInput,
): Promise<KozySynthesizeResult> {
  const validationError = validateInput(input);
  if (validationError) {
    return { ok: false, provider: "kozy", error: validationError };
  }

  if (!isEnabled()) {
    return { ok: false, provider: "kozy", error: "kozy provider is disabled (KOZY_ENABLED=false)" };
  }

  const t0 = Date.now();

  try {
    const body: Record<string, unknown> = {
      text: input.text.trim(),
      lang: input.lang ?? process.env.KOZY_DEFAULT_LANG ?? "ru",
      speed: input.speed ?? parseFloat(process.env.KOZY_DEFAULT_SPEED ?? "1.0"),
    };

    if (input.ref) {
      body.ref = input.ref;
    }

    if (input.filename) {
      body.filename = input.filename;
    }

    const url = `${KOZY_BASE_URL}/speak`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        ok: false,
        provider: "kozy",
        error: `Kozy HTTP ${response.status}: ${errorText || response.statusText}`,
      };
    }

    const result = (await response.json()) as Record<string, unknown>;

    const latencySec = (Date.now() - t0) / 1000;

    return {
      ok: true,
      provider: "kozy",
      file: typeof result.file === "string" ? result.file : undefined,
      filename: typeof result.filename === "string" ? result.filename : undefined,
      size_bytes: typeof result.size_bytes === "number" ? result.size_bytes : undefined,
      latency_sec: typeof result.latency_sec === "number" ? result.latency_sec : latencySec,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown kozy provider error";
    return { ok: false, provider: "kozy", error: message };
  }
}
