import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { RuntimeInput } from "../input/runtime-input.types.js";
import type { RuntimeModeResolution, RuntimeModeConfig } from "./runtime-mode.types.js";
import type { RuntimeAccessMode } from "../provider/provider.types.js";

const DEFAULT_CONFIG: RuntimeModeConfig = {
  creator_telegram_id: process.env.CREATOR_TELEGRAM_ID || "",
};

export class RuntimeModeResolver {
  private config: RuntimeModeConfig;

  constructor(config?: Partial<RuntimeModeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  resolve(input: RuntimeInput): RuntimeModeResolution {
    if (this.isCreator(input)) {
      const resolution: RuntimeModeResolution = {
        runtime_mode: "creator",
        reason: "verified_creator_identity",
        confidence: 1,
        evidence_required: true,
      };

      appendEvidenceRecord({
        evidence_id: hashTraceId(input.input_id, "runtime_mode_resolved"),
        trace_id: input.input_id,
        job_id: "mode",
        type: "runtime_mode_resolved" as any,
        timestamp: new Date().toISOString(),
        payload: {
          runtime_mode: "creator",
          reason: resolution.reason,
          user_id: input.user_id,
          surface: input.surface,
        },
      });

      return resolution;
    }

    if (this.isInternalSystem(input)) {
      const resolution: RuntimeModeResolution = {
        runtime_mode: "internal",
        reason: "internal_system_surface",
        confidence: 1,
        evidence_required: true,
      };

      appendEvidenceRecord({
        evidence_id: hashTraceId(input.input_id, "runtime_mode_resolved"),
        trace_id: input.input_id,
        job_id: "mode",
        type: "runtime_mode_resolved" as any,
        timestamp: new Date().toISOString(),
        payload: {
          runtime_mode: "internal",
          reason: resolution.reason,
          user_id: input.user_id,
          surface: input.surface,
        },
      });

      return resolution;
    }

    const resolution: RuntimeModeResolution = {
      runtime_mode: "public",
      reason: "default_public_mode",
      confidence: 1,
      evidence_required: true,
    };

    appendEvidenceRecord({
      evidence_id: hashTraceId(input.input_id, "runtime_mode_resolved"),
      trace_id: input.input_id,
      job_id: "mode",
      type: "runtime_mode_resolved" as any,
      timestamp: new Date().toISOString(),
      payload: {
        runtime_mode: "public",
        reason: resolution.reason,
        user_id: input.user_id,
        surface: input.surface,
      },
    });

    return resolution;
  }

  private isCreator(input: RuntimeInput): boolean {
    return (
      input.surface === "telegram" &&
      this.config.creator_telegram_id.length > 0 &&
      input.user_id === this.config.creator_telegram_id
    );
  }

  private isInternalSystem(input: RuntimeInput): boolean {
    return (
      input.surface === "api" &&
      input.metadata?.raw !== undefined &&
      (input.metadata.raw as Record<string, unknown>)?.system === true
    );
  }

  static resolveMode(input: RuntimeInput): RuntimeAccessMode {
    if (
      input.surface === "telegram" &&
      process.env.CREATOR_TELEGRAM_ID &&
      input.user_id === process.env.CREATOR_TELEGRAM_ID
    ) {
      return "creator";
    }
    return "public";
  }
}
