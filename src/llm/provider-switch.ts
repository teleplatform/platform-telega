export type Mode = "public" | "maker" | "creator";

export type ProviderId = "ollama_local" | "openai_api" | "creator_bridge";

export interface ExecutionCtx {
  mode: Mode;
  providerRequested?: ProviderId;
  consent_token?: string;
  trace_id: string;
  bridge_model?: string;
  [key: string]: unknown;
}

export interface ExecutionResult {
  status: "SUCCESS" | "DENIED" | "ERROR";
  provider: ProviderId;
  output?: string;
  error?: string;
}

export class ProviderSwitch {
  constructor(
    private providers: Map<ProviderId, any>,
    private policyGate: any,
    private evidence: any,
  ) {}

  async execute(prompt: string, ctx: ExecutionCtx): Promise<ExecutionResult> {
    const provider = this.resolveProvider(ctx);

    const verdict = this.policyGate.evaluate({
      provider,
      mode: ctx.mode,
      consent: Boolean(ctx.consent_token),
    });

    if (verdict === "HARD_DENY") {
      await this.evidence.log({
        event: "provider_denied",
        provider,
        mode: ctx.mode,
        trace_id: ctx.trace_id,
      });
      return {
        status: "DENIED",
        provider,
        error: "HARD_DENY",
      };
    }

    if (provider === "creator_bridge" && !ctx.consent_token) {
      throw new Error("CONSENT_REQUIRED");
    }

    try {
      const result = await this.providers.get(provider).generate(prompt, ctx);

      await this.evidence.log({
        event: "provider_success",
        provider,
        trace_id: ctx.trace_id,
      });

      return {
        status: "SUCCESS",
        provider,
        output: result,
      };
    } catch (err: any) {
      await this.evidence.log({
        event: "provider_error",
        provider,
        error: err?.message ?? String(err),
        trace_id: ctx.trace_id,
      });

      if (provider !== "ollama_local") {
        try {
          const fallback = await this.providers.get("ollama_local").generate(prompt, ctx);
          await this.evidence.log({
            event: "provider_fallback_success",
            provider,
            fallback_provider: "ollama_local",
            trace_id: ctx.trace_id,
          });
          return {
            status: "SUCCESS",
            provider: "ollama_local",
            output: fallback,
          };
        } catch (fallbackErr: any) {
          await this.evidence.log({
            event: "provider_fallback_error",
            provider,
            fallback_provider: "ollama_local",
            error: fallbackErr?.message ?? String(fallbackErr),
            trace_id: ctx.trace_id,
          });
        }
      }

      return {
        status: "ERROR",
        provider,
        error: err?.message ?? String(err),
      };
    }
  }

  private resolveProvider(ctx: ExecutionCtx): ProviderId {
    if (ctx.mode !== "creator" && ctx.providerRequested === "creator_bridge") {
      return "ollama_local";
    }

    return ctx.providerRequested ?? "ollama_local";
  }
}
