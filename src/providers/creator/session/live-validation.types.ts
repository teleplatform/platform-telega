export type LiveValidationTarget =
  | "chatgpt_web"
  | "qwen_web"
  | "deepseek_web";

export type LiveValidationStep =
  | "enable_provider"
  | "health_check"
  | "execute_prompt"
  | "validate_result"
  | "freeze_verdict";

export type LiveValidationVerdict =
  | "live_validated"
  | "failed"
  | "fallback_detected"
  | "session_not_ready";

export type LiveValidationStepResult = {
  step: LiveValidationStep;
  ok: boolean;
  details?: string;
};

export type LiveValidationReport = {
  ok: boolean;
  provider: LiveValidationTarget;
  step_results: LiveValidationStepResult[];

  health_state?: "ok" | "expired" | "captcha" | "blocked" | "unknown";

  provider_requested: string;
  provider_selected?: string;
  provider_final?: string;

  session_state?: string;
  submit_status?: string;
  response_status?: string;

  fallback_used?: boolean;
  fallback_reason?: string;

  trace_id?: string;
  output_preview?: string;

  verdict: LiveValidationVerdict;
  errors: string[];
};

export type ExecuteFnParams = {
  provider: string;
  input: string;
  creatorMode: boolean;
  trace_id?: string;
};

export type ExecuteFnResult = {
  success?: boolean;
  output_text?: string;
  session_state?: string;
  submit_status?: string;
  response_status?: string;
  provider_final?: string;
  fallback_used?: boolean;
  trace_id?: string;
  decisions?: Array<{
    step?: string;
    decision?: string;
    reason?: string;
  }>;
};

export type ExecuteFn = (params: ExecuteFnParams) => Promise<ExecuteFnResult>;

export type TraceReaderFn = (traceId: string) => Promise<any>;

export type LiveValidationConfig = {
  provider: LiveValidationTarget;
  executeFn: ExecuteFn;
  traceReader?: TraceReaderFn;
  prompt?: string;
  profileDir?: string;
};