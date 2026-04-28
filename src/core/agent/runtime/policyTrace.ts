// src/core/agent/runtime/policyTrace.ts
import type { JsonlTraceWriter } from "./traceWriter.js";

export async function tracePolicyChecked(
  tw: JsonlTraceWriter,
  sid: string,
  policy: string,
  meta?: any
) {
  await (tw as any).append?.(sid, { type: "policy.checked", policy, meta });
}

export async function tracePolicyDenied(
  tw: JsonlTraceWriter,
  sid: string,
  policy: string,
  reason: string,
  meta?: any
) {
  await (tw as any).append?.(sid, { type: "policy.denied", policy, reason, meta });
}
