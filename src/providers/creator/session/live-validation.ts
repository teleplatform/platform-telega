import type {
  LiveValidationReport,
  LiveValidationTarget,
  ExecuteFn,
  TraceReaderFn,
} from "./live-validation.types.js";
import { getSessionBridge } from "./session-bridge.js";
import { getTrace } from "../../../core/provider-trace.js";

function makeTraceId(provider: string): string {
  return `creator-session-live-${provider}-${Date.now()}`;
}

function extractTraceFields(trace: any) {
  const decisions = Array.isArray(trace?.decisions) ? trace.decisions : [];

  const sessionTransportDecision = decisions.find(
    (d: any) => d?.step === "session_transport"
  );
  const providerFinalDecision = decisions.find(
    (d: any) => d?.step === "provider_final"
  );
  const executeDecision = decisions.find(
    (d: any) => d?.step === "execute" || d?.step === "fallback"
  );

  const final = trace?.final;

  return {
    provider_selected: final?.provider,
    provider_final: final?.provider || providerFinalDecision?.reason?.split(":")[0],
    session_state: sessionTransportDecision?.reason?.split(",")[0]?.replace("session:", "") ||
                    sessionTransportDecision?.reason,
    submit_status: providerFinalDecision?.reason?.split(",")[1]?.replace("submit:", ""),
    response_status: providerFinalDecision?.reason?.split(",")[2]?.replace("response:", ""),
    fallback_used: final?.fallback_used ?? executeDecision?.decision === "fallback_to",
    fallback_reason: executeDecision?.reason,
  };
}

export async function runCreatorSessionLiveValidation(args: {
  provider: LiveValidationTarget;
  executeFn: ExecuteFn;
  traceReader?: TraceReaderFn;
  prompt?: string;
}): Promise<LiveValidationReport> {
  const {
    provider,
    executeFn,
    traceReader,
    prompt = "Ответь одним словом: READY",
  } = args;

  const trace_id = makeTraceId(provider);

  const report: LiveValidationReport = {
    ok: false,
    provider,
    provider_requested: provider,
    trace_id,
    step_results: [],
    errors: [],
    verdict: "failed",
  };

  const sessionBridge = getSessionBridge();

  try {
    sessionBridge.enableProvider(provider);
    sessionBridge.setCreatorMode(true);
    report.step_results.push({
      step: "enable_provider",
      ok: true,
      details: `${provider} enabled with creator mode`,
    });
  } catch (error: any) {
    report.step_results.push({
      step: "enable_provider",
      ok: false,
      details: error?.message || "enableProvider failed",
    });
    report.errors.push("enable_provider_failed");
    report.verdict = "failed";
    return report;
  }

  let health: any;
  try {
    health = await sessionBridge.checkHealth(provider);
    report.health_state = (health?.state as any) || (health?.available ? "ok" : "unknown");
    report.session_state = report.health_state;

    const healthOk = report.health_state === "ok";

    report.step_results.push({
      step: "health_check",
      ok: healthOk,
      details: `session_state=${report.health_state}, healthScore=${health?.healthScore || 0}`,
    });

    if (!healthOk) {
      report.errors.push(`health_not_ok:${report.health_state}`);
      report.verdict = "session_not_ready";
      return report;
    }
  } catch (error: any) {
    report.step_results.push({
      step: "health_check",
      ok: false,
      details: error?.message || "health check failed",
    });
    report.errors.push("health_check_failed");
    report.verdict = "session_not_ready";
    return report;
  }

  let execResult: any;
  try {
    execResult = await executeFn({
      provider,
      input: prompt,
      creatorMode: true,
      trace_id,
    });

    report.output_preview =
      typeof execResult?.text === "string"
        ? execResult.text.slice(0, 120)
        : execResult?.output_text?.slice(0, 120);

    report.step_results.push({
      step: "execute_prompt",
      ok: true,
      details: "execution completed",
    });
  } catch (error: any) {
    report.step_results.push({
      step: "execute_prompt",
      ok: false,
      details: error?.message || "execution failed",
    });
    report.errors.push("execute_prompt_failed");
    report.verdict = "failed";
    return report;
  }

  let trace: any = undefined;
  if (traceReader) {
    try {
      trace = await traceReader(trace_id);
    } catch (error: any) {
      report.errors.push("trace_read_failed");
    }
  }

  if (!trace && execResult?.trace_id) {
    try {
      trace = getTrace(execResult.trace_id);
    } catch {
      report.errors.push("trace_fetch_failed");
    }
  }

  const fields = extractTraceFields(trace || execResult?.trace || execResult || {});
  console.log(`[live-validation] extractTraceFields:`, JSON.stringify(fields));
  console.log(`[live-validation] execResult:`, JSON.stringify({
    ok: execResult?.ok,
    provider: execResult?.provider,
    model: execResult?.model,
    text: execResult?.text?.slice(0, 100),
    fallbackUsed: execResult?.fallbackUsed,
  }));
  
  report.provider_selected = fields.provider_selected || execResult?.provider || provider;
  report.provider_final = fields.provider_final || execResult?.provider || (execResult?.ok ? provider : undefined);
  report.session_state = fields.session_state || report.session_state;
  report.submit_status = fields.submit_status;
  report.response_status = fields.response_status;
  report.fallback_used = Boolean(fields.fallback_used ?? execResult?.fallbackUsed);
  report.fallback_reason = fields.fallback_reason;

  const checks = [
    report.session_state === "ok" || report.session_state === undefined,
    report.submit_status === "sent" || report.submit_status === undefined,
    report.response_status === "received" || report.response_status === undefined,
    report.provider_final === provider,
    report.fallback_used === false,
  ];

  const validateOk = checks.every(Boolean);

  report.step_results.push({
    step: "validate_result",
    ok: validateOk,
    details: [
      `session_state=${report.session_state || "unknown"}`,
      `submit_status=${report.submit_status || "unknown"}`,
      `response_status=${report.response_status || "unknown"}`,
      `provider_final=${report.provider_final || "unknown"}`,
      `fallback_used=${String(report.fallback_used)}`,
    ].join(", "),
  });

  if (!validateOk) {
    if (report.fallback_used) {
      report.errors.push("fallback_detected");
      report.verdict = "fallback_detected";
    } else {
      report.errors.push("live_validation_checks_failed");
      report.verdict = "failed";
    }
    return report;
  }

  report.step_results.push({
    step: "freeze_verdict",
    ok: true,
    details: `Creator Session Bridge validated for ${provider}`,
  });

  report.ok = true;
  report.verdict = "live_validated";
  return report;
}