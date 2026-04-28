export function makeTraceId(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require("crypto") as typeof import("crypto");
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // fallback below
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function pickIncomingTraceId(req: Request): string | null {
  const v = req.headers.get("x-telegpt-trace-id");
  return v && v.trim() ? v.trim() : null;
}
