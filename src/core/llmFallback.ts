import type { ProviderSpec } from "./policyRouter.js";
import type { ChatRequest, ChatResponse } from "../types/chat.js";

export type ProviderFailure = {
  provider: string;
  model: string;
  error_code: string;
  error_message?: string;
};

export type FallbackResult = {
  reply: string;
  provider: string;
  model: string;
  meta?: any;
  fallback_used: boolean;
  failures: ProviderFailure[];
  attempt_number: number;
};

type ProviderCaller = (spec: ProviderSpec, req: ChatRequest) => Promise<ChatResponse>;

export async function runWithFallback(
  chain: ProviderSpec[],
  callProvider: ProviderCaller,
  request: ChatRequest
): Promise<FallbackResult> {
  const failures: ProviderFailure[] = [];
  let attemptNumber = 0;

  for (const spec of chain) {
    attemptNumber++;
    try {
      const response = await callProvider(spec, request);
      
      return {
        reply: response.output ?? "",
        provider: spec.provider,
        model: spec.model,
        meta: response.meta,
        fallback_used: attemptNumber > 1,
        failures,
        attempt_number: attemptNumber,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorCode = errorMessage.includes("timeout")
        ? "TIMEOUT"
        : errorMessage.includes("connect")
        ? "CONNECTION_ERROR"
        : errorMessage.includes("401") || errorMessage.includes("403")
        ? "AUTH_ERROR"
        : errorMessage.includes("429")
        ? "RATE_LIMIT"
        : "UPSTREAM_ERROR";

      failures.push({
        provider: spec.provider,
        model: spec.model,
        error_code: errorCode,
        error_message: errorMessage.slice(0, 200),
      });

      // Continue to next provider in chain
      continue;
    }
  }

  // All providers failed, return local-demo fallback
  return {
    reply: "All providers unavailable. Service is temporarily limited.",
    provider: "local",
    model: "local-demo",
    fallback_used: true,
    failures,
    attempt_number: attemptNumber,
  };
}
