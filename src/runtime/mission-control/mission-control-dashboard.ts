import fs from "node:fs";
import path from "node:path";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { getAllBudgets } from "../economy/runtime-budget-engine.js";
import { getOpenIncidents } from "../incidents/runtime-incident-command.js";
import { getPendingApprovals as getPendingIncidentApprovals } from "../incidents/incident-approval-gate.js";
import { listPendingExecutionApprovals } from "../policy/execution-approval-queue.js";
import { validateTelegramMissionControlConfig } from "./telegram-sender.js";
import {
  generateOperationalDigest,
  getRuntimeOperatorPresence,
  readMissionControlPersistenceFeed,
} from "./operational-runtime.js";
import { createRuntimeRecoveryDashboard } from "./recovery-operations.js";
import {
  calculateRuntimeStabilityScore,
  generateOperationalMetrics,
  getRuntimeMaintenanceState,
} from "./coordination-runtime.js";
import { buildFederationStabilitySurface } from "./federation-operations.js";
import { createRuntimeIntelligenceDashboard } from "./intelligence-operations.js";
import { createSecurityMissionControlDashboard } from "./security-operations.js";
import { createGovernanceDashboard } from "./governance-operations.js";

export interface MissionControlDashboardSnapshot {
  snapshot_id: string;
  created_at: string;
  loop: {
    recent_chat_preflights: number;
    closures: number;
    live_feed_events: number;
    mode_blocks: number;
  };
  live_feed: Array<{
    event_id?: string;
    kind?: string;
    severity?: string;
    title?: string;
    trace_id: string;
    created_at: string;
  }>;
  persistence_feed: ReturnType<typeof readMissionControlPersistenceFeed>;
  operator: ReturnType<typeof getRuntimeOperatorPresence>;
  digest: Awaited<ReturnType<typeof generateOperationalDigest>>;
  recovery: Awaited<ReturnType<typeof createRuntimeRecoveryDashboard>>;
  coordination: {
    maintenance: ReturnType<typeof getRuntimeMaintenanceState>;
    metrics: Awaited<ReturnType<typeof generateOperationalMetrics>>;
    stability: Awaited<ReturnType<typeof calculateRuntimeStabilityScore>>;
  };
  federation: Awaited<ReturnType<typeof buildFederationStabilitySurface>>;
  intelligence: Awaited<ReturnType<typeof createRuntimeIntelligenceDashboard>>;
  security: Awaited<ReturnType<typeof createSecurityMissionControlDashboard>>;
  governance: Awaited<ReturnType<typeof createGovernanceDashboard>>;
  incidents: ReturnType<typeof getOpenIncidents>;
  approvals: {
    replay: ReturnType<typeof listPendingReplayApprovals>;
    execution: ReturnType<typeof listPendingExecutionApprovals>;
    incident: ReturnType<typeof getPendingIncidentApprovals>;
  };
  burn_rate: {
    generated_at: string;
    window_minutes: number;
    total_consumed: number;
    burn_rate_per_minute: number;
    anomalies: string[];
    budgets: Array<{ category: string; used: number; limit: number; used_ratio: number }>;
  };
  telegram: Awaited<ReturnType<typeof validateTelegramMissionControlConfig>>;
}

function listPendingReplayApprovals(): Array<Record<string, unknown>> {
  const approvalPath = path.join(process.cwd(), ".data", "execution-evidence", "replay-approvals.jsonl");
  if (fs.existsSync(approvalPath)) {
    const fileApprovals = fs.readFileSync(approvalPath, "utf8")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((record): record is Record<string, unknown> => !!record && record.status === "pending");
    if (fileApprovals.length > 0) return fileApprovals;
  }

  return readEvidenceRecords({ type: "telegram_inline_keyboard_rendered" })
    .filter((record) => {
      const keyboard = record.payload?.reply_markup as { inline_keyboard?: Array<Array<{ callback_data?: string }>> } | undefined;
      return keyboard?.inline_keyboard?.flat().some((button) => button.callback_data?.startsWith("replay:"));
    })
    .map((record) => ({
      approval_id: record.payload?.approval_id,
      trace_id: record.trace_id,
      status: "pending",
      source: "rendered_keyboard",
    }));
}

function aggregateLiveFeed(limit = 50): MissionControlDashboardSnapshot["live_feed"] {
  return readEvidenceRecords({ type: "mission_control_live_event_emitted", order: "desc", limit })
    .map((record) => ({
      event_id: String(record.payload?.event_id || ""),
      kind: String(record.payload?.kind || ""),
      severity: String(record.payload?.severity || ""),
      title: String(record.payload?.title || ""),
      trace_id: record.trace_id,
      created_at: record.timestamp,
    }));
}

function calculateMissionControlBurnRate(windowMinutes = 60): MissionControlDashboardSnapshot["burn_rate"] {
  const now = Date.now();
  const windowMs = windowMinutes * 60_000;
  const consumedRecords = readEvidenceRecords({ type: "runtime_budget_consumed", order: "asc" }).filter((record) => {
    const ts = new Date(record.timestamp).getTime();
    return Number.isFinite(ts) && ts >= now - windowMs;
  });
  const totalConsumed = consumedRecords.reduce((sum, record) => sum + Number(record.payload?.consumed || 0), 0);
  const budgets = getAllBudgets().map((budget) => ({
    category: budget.category,
    used: budget.used,
    limit: budget.limit,
    used_ratio: budget.limit > 0 ? budget.used / budget.limit : 1,
  }));
  return {
    generated_at: new Date().toISOString(),
    window_minutes: windowMinutes,
    total_consumed: totalConsumed,
    burn_rate_per_minute: totalConsumed / Math.max(1, windowMinutes),
    anomalies: budgets.filter((budget) => budget.used_ratio >= 0.9).map((budget) => `budget_${budget.category}_above_90_percent`),
    budgets,
  };
}

export async function createMissionControlDashboardSnapshot(input?: {
  feed_limit?: number;
  validate_send_test?: boolean;
}): Promise<MissionControlDashboardSnapshot> {
  const records = readEvidenceRecords({ limit: 500 });
  return {
    snapshot_id: `mission_control_${Date.now()}`,
    created_at: new Date().toISOString(),
    loop: {
      recent_chat_preflights: records.filter((record) => record.type === "chat_route_preflight_started").length,
      closures: records.filter((record) => record.type === "runtime_closure_completed").length,
      live_feed_events: records.filter((record) => record.type === "mission_control_live_event_emitted").length,
      mode_blocks: records.filter((record) => record.type === "runtime_mode_blocked").length,
    },
    live_feed: aggregateLiveFeed(input?.feed_limit || 50),
    persistence_feed: readMissionControlPersistenceFeed(input?.feed_limit || 50),
    operator: getRuntimeOperatorPresence(),
    digest: await generateOperationalDigest(),
    recovery: await createRuntimeRecoveryDashboard(),
    coordination: {
      maintenance: getRuntimeMaintenanceState(),
      metrics: await generateOperationalMetrics(),
      stability: await calculateRuntimeStabilityScore(),
    },
    federation: await buildFederationStabilitySurface(),
    intelligence: await createRuntimeIntelligenceDashboard(),
    security: await createSecurityMissionControlDashboard(),
    governance: await createGovernanceDashboard(),
    incidents: getOpenIncidents(),
    approvals: {
      replay: listPendingReplayApprovals(),
      execution: listPendingExecutionApprovals(),
      incident: getPendingIncidentApprovals(),
    },
    burn_rate: calculateMissionControlBurnRate(),
    telegram: await validateTelegramMissionControlConfig({ send_test: input?.validate_send_test === true }),
  };
}
