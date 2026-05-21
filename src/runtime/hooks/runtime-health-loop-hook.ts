import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { createRuntimeObservation, type RuntimeObservation } from "../self/runtime-self-observation.js";
import { assessCognitiveHealth, type CognitiveHealthState } from "../self/runtime-cognitive-health.js";
import { detectPressure, type PressureSignal } from "../regulation/civilization-pressure-monitoring.js";
import { applyGovernanceThrottle, type ThrottleAction } from "../regulation/adaptive-governance-throttling.js";

export interface RuntimeHealthLoopRun {
  run_id: string;
  ran_at: string;
  observation: RuntimeObservation;
  cognitive_health: CognitiveHealthState;
  pressure: PressureSignal;
  throttle: ThrottleAction;
}

export interface RuntimeHealthLoopStatus {
  running: boolean;
  enabled: boolean;
  interval_ms: number;
  last_run_at?: string;
  run_count: number;
}

let timer: ReturnType<typeof setInterval> | undefined;
let lastRunAt: string | undefined;
let runCount = 0;

function configuredInterval(): number {
  return Math.max(1000, Number(process.env.RUNTIME_HEALTH_LOOP_INTERVAL_MS) || 60_000);
}

function configuredEnabled(): boolean {
  return process.env.RUNTIME_HEALTH_LOOP_ENABLED === "true";
}

export async function runRuntimeHealthLoop(): Promise<RuntimeHealthLoopRun> {
  runCount++;
  const runId = `health_loop_${Date.now()}_${runCount}`;
  const observation = await createRuntimeObservation();
  const cognitiveHealth = await assessCognitiveHealth();
  const pressure = detectPressure();
  const throttle = await applyGovernanceThrottle();
  lastRunAt = new Date().toISOString();

  const run: RuntimeHealthLoopRun = {
    run_id: runId,
    ran_at: lastRunAt,
    observation,
    cognitive_health: cognitiveHealth,
    pressure,
    throttle,
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(runId, "runtime_health_loop_ran"),
    trace_id: runId,
    job_id: "health",
    type: "runtime_health_loop_ran",
    timestamp: run.ran_at,
    payload: {
      observation_id: observation.observation_id,
      cognitive_health: cognitiveHealth.level,
      cognitive_score: cognitiveHealth.score,
      pressure_id: pressure.signal_id,
      throttle_id: throttle.throttle_id,
      throttle_action: throttle.action,
    },
  });

  return run;
}

export async function startRuntimeHealthLoop(): Promise<RuntimeHealthLoopStatus> {
  if (timer) return getRuntimeHealthLoopStatus();

  await appendEvidenceRecord({
    evidence_id: hashTraceId("runtime_health_loop", "runtime_health_loop_started"),
    trace_id: "runtime_health_loop",
    job_id: "health",
    type: "runtime_health_loop_started",
    timestamp: new Date().toISOString(),
    payload: { interval_ms: configuredInterval(), enabled: configuredEnabled() },
  });

  timer = setInterval(() => {
    runRuntimeHealthLoop().catch((e) => {
      console.error(`[runtime-health-loop] run failed: ${e?.message || e}`);
    });
  }, configuredInterval());

  return getRuntimeHealthLoopStatus();
}

export async function stopRuntimeHealthLoop(): Promise<RuntimeHealthLoopStatus> {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }

  await appendEvidenceRecord({
    evidence_id: hashTraceId("runtime_health_loop", "runtime_health_loop_stopped"),
    trace_id: "runtime_health_loop",
    job_id: "health",
    type: "runtime_health_loop_stopped",
    timestamp: new Date().toISOString(),
    payload: { run_count: runCount },
  });

  return getRuntimeHealthLoopStatus();
}

export function getRuntimeHealthLoopStatus(): RuntimeHealthLoopStatus {
  return {
    running: !!timer,
    enabled: configuredEnabled(),
    interval_ms: configuredInterval(),
    last_run_at: lastRunAt,
    run_count: runCount,
  };
}

if (configuredEnabled()) {
  startRuntimeHealthLoop().catch((e) => {
    console.error(`[runtime-health-loop] start failed: ${e?.message || e}`);
  });
}
