import {
  getTraceSummary,
  getTraceTimeline,
  getFailedGates,
  getRetryHistory,
  getRuntimeDecision,
  listAllTraces,
} from "./trace-inspector.js";
import { buildReplayCandidate, planReplay } from "./replay-planner.js";
import { executeReplay } from "./replay-executor.js";
import { evaluateReplayGovernance } from "./replay-governance.js";
import {
  listPendingApprovals,
  approveReplay,
  denyReplay,
  executeApprovedReplay,
} from "./replay-approval-queue.js";
import { sweepExpiredApprovals, getReplayApprovalSweeperStatus, startReplayApprovalSweeper, stopReplayApprovalSweeper } from "./replay-approval-sweeper.js";
import { buildReplayApprovalAuditReport } from "./replay-approval-audit.js";
import { getTraceLineage } from "./trace-lineage.js";
import { sweepOldEvidence, getEvidenceRetentionStatus } from "./evidence-retention.js";
import { checkRuntimeHealth } from "../health/runtime-health-aggregator.js";
import { createRuntimeBaseline, compareRuntimeBaseline } from "../health/runtime-baseline.js";
import { checkRuntimeDriftGate } from "../health/runtime-drift-gate.js";
import { checkRuntimePreflight } from "./runtime-preflight-gate.js";
import { buildAndRenderCompletionReport } from "../completion/completion-report-renderer.js";
import { createArtifactBundle, getArtifactBundle } from "../artifacts/artifact-bundle-export.js";
import { listImprovements, registerAllApprovedProposals, updateImprovementStatus } from "../learning/runtime-improvement-registry.js";
import { createOperationalFreeze, compareOperationalFreeze } from "../ops/operational-baseline-freeze.js";
import { loadExecutionPolicy, evaluateExecutionPolicy, getExecutionPolicyHash } from "./execution-policy-gate.js";
import {
  createExecutionApprovalRequest,
  approveExecutionApproval,
  denyExecutionApproval,
  markExecutionApprovalConsumed,
  listPendingExecutionApprovals,
} from "../policy/execution-approval-queue.js";
import { createOperationalLoopDashboardSnapshot } from "../hooks/operational-loop-dashboard-snapshot.js";
import { inspectOperationalLoopTrace } from "../hooks/living-loop-hardening.js";

function parseArgs(): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = process.argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const json = Boolean(args.json);

  if (args.list) {
    const limit = typeof args.list === "string" ? Number(args.list) : 20;
    const traces = listAllTraces(limit);
    if (json) {
      console.log(JSON.stringify({ ok: true, traces, count: traces.length }, null, 2));
    } else {
      console.log(formatTracesTable(traces));
    }
    return;
  }

  if (args["operational-loop"]) {
    const snapshot = await createOperationalLoopDashboardSnapshot();
    if (json) {
      console.log(JSON.stringify({ ok: true, snapshot }, null, 2));
    } else {
      console.log("OPERATIONAL LOOP SNAPSHOT");
      console.log(`  snapshot_id:       ${snapshot.snapshot_id}`);
      console.log(`  created_at:        ${snapshot.created_at}`);
      console.log(`  chat_preflights:   ${snapshot.recent_chat_preflights}`);
      console.log(`  decision_points:   ${snapshot.decision_points}`);
      console.log(`  planning:          ${snapshot.planning_activations}`);
      console.log(`  incidents_open:    ${snapshot.incidents_open}`);
      console.log(`  live_events:       ${snapshot.live_feed_events}`);
      console.log(`  closures:          ${snapshot.closures}`);
      console.log(`  mode_blocks:       ${snapshot.mode_blocks}`);
      console.log(`  health_loop:       ${snapshot.health_loop.running ? "running" : "stopped"}`);
    }
    return;
  }

  if (args.approvals) {
    const approvals = listPendingApprovals();
    if (json) {
      console.log(JSON.stringify({ ok: true, approvals, count: approvals.length }, null, 2));
    } else {
      console.log(`PENDING APPROVALS (${approvals.length})`);
      if (approvals.length === 0) {
        console.log("  (none)");
      }
      for (const a of approvals) {
        console.log(`  ${a.approval_id}`);
        console.log(`    trace_id:        ${a.trace_id}`);
        console.log(`    requested_by:    ${a.requested_by}`);
        console.log(`    replay_reason:   ${a.replay_reason || "-"}`);
        console.log(`    target_override: ${a.target_override || "-"}`);
        console.log(`    force:           ${a.force ? "yes" : "no"}`);
        console.log(`    created_at:      ${a.created_at}`);
        console.log(`    expires_at:      ${a.expires_at || "-"}`);
      }
    }
    return;
  }

  if (args.approve) {
    const approvalId = args.approve as string;
    const result = await approveReplay(approvalId, "cli");
    if (json) {
      console.log(JSON.stringify({ ok: !!result, approval: result, approval_id: approvalId }));
    } else {
      if (result) {
        console.log(`APPROVED: ${approvalId}`);
      } else {
        console.error(`Cannot approve ${approvalId}: not found or not pending`);
        process.exit(1);
      }
    }
    return;
  }

  if (args.deny) {
    const approvalId = args.deny as string;
    const result = await denyReplay(approvalId, "cli");
    if (json) {
      console.log(JSON.stringify({ ok: !!result, approval: result, approval_id: approvalId }));
    } else {
      if (result) {
        console.log(`DENIED: ${approvalId}`);
      } else {
        console.error(`Cannot deny ${approvalId}: not found or not pending`);
        process.exit(1);
      }
    }
    return;
  }

  if (args["sweep-approvals"]) {
    const result = await sweepExpiredApprovals();
    if (json) {
      console.log(JSON.stringify({ ok: true, ...result }));
    } else {
      console.log(`SWEEP APPROVALS`);
      console.log(`  expired: ${result.expired}`);
      console.log(`  edited:  ${result.edited}`);
    }
    return;
  }

  if (args["sweeper-status"]) {
    const status = getReplayApprovalSweeperStatus();
    if (json) {
      console.log(JSON.stringify({ ok: true, ...status }));
    } else {
      console.log(`SWEEPER STATUS`);
      console.log(`  enabled:    ${status.enabled}`);
      console.log(`  running:    ${status.running}`);
      console.log(`  interval_ms: ${status.interval_ms}`);
      console.log(`  last_run_at: ${status.last_run_at || "-"}`);
      if (status.last_result) {
        console.log(`  last_result:`);
        console.log(`    scanned: ${status.last_result.scanned}`);
        console.log(`    expired: ${status.last_result.expired}`);
        console.log(`    edited:  ${status.last_result.edited}`);
        console.log(`    errors:  ${status.last_result.errors}`);
      }
    }
    return;
  }

  if (args["sweeper-start"]) {
    const started = await startReplayApprovalSweeper();
    if (json) {
      console.log(JSON.stringify({ ok: true, started }));
    } else {
      console.log(`SWEEPER START: ${started ? "started" : "already running"}`);
    }
    return;
  }

  if (args["sweeper-stop"]) {
    const stopped = await stopReplayApprovalSweeper();
    if (json) {
      console.log(JSON.stringify({ ok: true, stopped }));
    } else {
      console.log(`SWEEPER STOP: ${stopped ? "stopped" : "was not running"}`);
    }
    return;
  }

  if (args["approval-audit"]) {
    const report = await buildReplayApprovalAuditReport();
    if (json) {
      console.log(JSON.stringify({ ok: true, ...report }));
    } else {
      console.log(`APPROVAL AUDIT REPORT`);
      console.log(`generated_at: ${report.generated_at}`);
      console.log(`\nApproval Stats:`);
      for (const [k, v] of Object.entries(report.approval_stats)) {
        console.log(`  ${k}: ${v}`);
      }
      console.log(`\nReplay Stats:`);
      for (const [k, v] of Object.entries(report.replay_stats)) {
        console.log(`  ${k}: ${v}`);
      }
      console.log(`\nCallback Stats:`);
      for (const [k, v] of Object.entries(report.callback_stats)) {
        console.log(`  ${k}: ${v}`);
      }
      console.log(`\nevidence_total: ${report.evidence_total}`);
    }
    return;
  }

  if (args["retention-status"]) {
    const status = getEvidenceRetentionStatus();
    if (json) {
      console.log(JSON.stringify({ ok: true, ...status }));
    } else {
      console.log(`EVIDENCE RETENTION STATUS`);
      console.log(`  retention_days:  ${status.retention_days}`);
      console.log(`  archive_enabled: ${status.archive_enabled}`);
      console.log(`  store_path:      ${status.store_path}`);
      console.log(`  archive_path:    ${status.archive_path}`);
      console.log(`  total_records:   ${status.total_records}`);
      if (status.last_archive) console.log(`  last_archive:    ${status.last_archive}`);
    }
    return;
  }

  if (args["retention-sweep"]) {
    const result = await sweepOldEvidence();
    if (json) {
      console.log(JSON.stringify({ ok: true, ...result }));
    } else {
      console.log(`EVIDENCE RETENTION SWEEP`);
      console.log(`  archived: ${result.archived}`);
      console.log(`  kept:     ${result.kept}`);
      console.log(`  total:    ${result.total}`);
      console.log(`  archive:  ${result.archive_path}`);
    }
    return;
  }

  if (args["runtime-health"]) {
    const health = await checkRuntimeHealth();
    if (json) {
      console.log(JSON.stringify({ ok: true, ...health }));
    } else {
      console.log(`RUNTIME HEALTH: ${health.status.toUpperCase()}`);
      for (const [key, check] of Object.entries(health.checks)) {
        const icon = check.status === "healthy" ? "✓" : check.status === "warning" ? "⚠" : check.status === "degraded" ? "✗" : "💥";
        console.log(`  ${icon} ${key}: ${check.message}`);
      }
      if (health.warnings.length > 0) {
        console.log(`\nWarnings:`);
        for (const w of health.warnings) console.log(`  • ${w}`);
      }
    }
    return;
  }

  if (args["baseline-create"]) {
    const baseline = await createRuntimeBaseline();
    if (json) {
      console.log(JSON.stringify({ ok: true, baseline }));
    } else {
      console.log(`BASELINE CREATED`);
      console.log(`  created_at:     ${baseline.created_at}`);
      console.log(`  package:        ${baseline.package_version}`);
      console.log(`  profiles:       ${baseline.capability_profiles.length}`);
      console.log(`  evidence:       ${baseline.evidence_stats.total_records}`);
      console.log(`  approvals:      ${baseline.approval_queue_stats.total}`);
      console.log(`  traces:         ${baseline.trace_count}`);
      console.log(`  policy_hash:    ${baseline.policy_hash}`);
      console.log(`  env_vars:       ${Object.keys(baseline.env_summary).length}`);
      console.log(`  routes:         ${baseline.route_list.length}`);
    }
    return;
  }

  if (args["baseline-compare"]) {
    const result = await compareRuntimeBaseline();
    if (json) {
      console.log(JSON.stringify({ ok: true, ...result }));
    } else {
      console.log(`BASELINE COMPARISON`);
      console.log(`  created_at:              ${result.comparison.created_at}`);
      console.log(`  package_version_same:    ${result.comparison.package_version_same}`);
      console.log(`  policy_hash_same:        ${result.comparison.policy_hash_same}`);
      console.log(`  profile_count_changed:   ${result.comparison.profile_count_changed}`);
      console.log(`  evidence_growth:         ${result.comparison.evidence_growth}`);
      console.log(`  approval_queue_growth:   ${result.comparison.approval_queue_growth}`);
      console.log(`  trace_growth:            ${result.comparison.trace_growth}`);
      if (result.comparison.details.length > 0) {
        console.log(`\n  Drift details:`);
        for (const d of result.comparison.details) console.log(`    • ${d}`);
      } else {
        console.log(`\n  No drift detected`);
      }
    }
    return;
  }

  if (args["drift-gate"]) {
    const gate = await checkRuntimeDriftGate();
    if (json) {
      console.log(JSON.stringify({ ok: true, ...gate }));
    } else {
      console.log(`DRIFT GATE`);
      console.log(`  allowed:      ${gate.allowed}`);
      console.log(`  severity:     ${gate.severity}`);
      console.log(`  reason:       ${gate.reason || "-"}`);
      console.log(`  enabled:      ${gate.env_config.enabled}`);
      console.log(`  max_severity: ${gate.env_config.max_severity}`);
      if (gate.details.length > 0) {
        console.log(`  details:`);
        for (const d of gate.details) console.log(`    • ${d}`);
      }
    }
    return;
  }

  if (args["execution-approvals"]) {
    const approvals = listPendingExecutionApprovals();
    if (json) {
      console.log(JSON.stringify({ ok: true, approvals, count: approvals.length }));
    } else {
      console.log(`EXECUTION APPROVALS (${approvals.length})`);
      if (approvals.length === 0) {
        console.log("  (none)");
      }
      for (const a of approvals) {
        console.log(`  ${a.approval_id}`);
        console.log(`    task_kind:     ${a.task_kind}`);
        console.log(`    target:        ${a.target || "-"}`);
        console.log(`    reason:        ${a.reason}`);
        console.log(`    requested_by:  ${a.requested_by}`);
        console.log(`    created_at:    ${a.created_at}`);
        console.log(`    expires_at:    ${a.expires_at || "-"}`);
      }
    }
    return;
  }

  if (args["execution-approve"]) {
    const approvalId = args["execution-approve"] as string;
    const result = await approveExecutionApproval(approvalId, "cli");
    if (json) {
      console.log(JSON.stringify({ ok: !!result, approval: result, approval_id: approvalId }));
    } else {
      if (result) {
        console.log(`APPROVED: ${approvalId}`);
      } else {
        console.error(`Cannot approve ${approvalId}: not found or not pending`);
        process.exit(1);
      }
    }
    return;
  }

  if (args["execution-deny"]) {
    const approvalId = args["execution-deny"] as string;
    const result = await denyExecutionApproval(approvalId, "cli");
    if (json) {
      console.log(JSON.stringify({ ok: !!result, approval: result, approval_id: approvalId }));
    } else {
      if (result) {
        console.log(`DENIED: ${approvalId}`);
      } else {
        console.error(`Cannot deny ${approvalId}: not found or not pending`);
        process.exit(1);
      }
    }
    return;
  }

  if (args["execution-consume"]) {
    const approvalId = args["execution-consume"] as string;
    const result = await markExecutionApprovalConsumed(approvalId);
    if (json) {
      console.log(JSON.stringify({ ok: !!result, approval: result, approval_id: approvalId }));
    } else {
      if (result) {
        console.log(`CONSUMED: ${approvalId}`);
      } else {
        console.error(`Cannot consume ${approvalId}: not found or not approved`);
        process.exit(1);
      }
    }
    return;
  }

  if (args["freeze-create"]) {
    const freeze = await createOperationalFreeze();
    if (json) {
      console.log(JSON.stringify({ ok: true, freeze }));
    } else {
      console.log(`OPERATIONAL FREEZE CREATED`);
      console.log(`  created_at:     ${freeze.created_at}`);
      console.log(`  git_commit:     ${freeze.git_commit || "-"}`);
      console.log(`  health:         ${freeze.health.status}`);
      console.log(`  evidence:       ${freeze.evidence_total}`);
      console.log(`  traces:         ${freeze.trace_count}`);
      console.log(`  replay_policy:  ${freeze.policy_hashes.replay_policy}`);
      console.log(`  exec_policy:    ${freeze.policy_hashes.execution_policy}`);
      console.log(`  profiles:       ${freeze.capability_profiles.length}`);
      console.log(`  sweeper:        ${freeze.sweeper.running ? "running" : "stopped"}`);
      console.log(`  telegram:       ${freeze.telegram.enabled ? "enabled" : freeze.telegram.dry_run ? "dry-run" : "disabled"}`);
    }
    return;
  }

  if (args["freeze-compare"]) {
    const result = await compareOperationalFreeze();
    if (json) {
      console.log(JSON.stringify({ ok: true, ...result }));
    } else {
      console.log(`OPERATIONAL FREEZE COMPARISON`);
      console.log(`  created_at:         ${result.comparison.created_at}`);
      console.log(`  git_changed:        ${result.comparison.git_commit_changed}`);
      console.log(`  replay_policy:      ${result.comparison.replay_policy_changed ? "CHANGED" : "same"}`);
      console.log(`  exec_policy:        ${result.comparison.execution_policy_changed ? "CHANGED" : "same"}`);
      console.log(`  profiles:           ${result.comparison.profile_count_changed ? "CHANGED" : "same"}`);
      console.log(`  health:             ${result.comparison.health_status_changed ? "CHANGED" : "same"}`);
      console.log(`  evidence_growth:    ${result.comparison.evidence_growth > 0 ? `+${result.comparison.evidence_growth}` : "0"}`);
      console.log(`  trace_growth:       ${result.comparison.trace_growth > 0 ? `+${result.comparison.trace_growth}` : "0"}`);
      if (result.comparison.details.length > 0) {
        console.log(`\n  Drift details:`);
        for (const d of result.comparison.details) console.log(`    • ${d}`);
      } else {
        console.log(`\n  No drift detected`);
      }
    }
    return;
  }

  if (args["execution-policy"]) {
    const traceId = typeof args["execution-policy"] === "string" ? args["execution-policy"] : undefined;
    loadExecutionPolicy();
    const hash = getExecutionPolicyHash();
    if (json) {
      const policyResult = traceId
        ? evaluateExecutionPolicy({
            task_kind: typeof args["kind"] === "string" ? args["kind"] as string : "generic",
            target: typeof args.target === "string" ? args.target : undefined,
            requested_by: (typeof args.requested_by === "string" ? args.requested_by : "manual") as any,
            is_replay: args.is_replay === "true",
            force: args.force === true,
            target_override: args.target_override === "true",
          })
        : null;
      console.log(JSON.stringify({ ok: true, hash, policy_result: policyResult ? { decision: policyResult.decision, reason: policyResult.reason } : null }));
    } else {
      console.log(`EXECUTION POLICY`);
      console.log(`  hash:    ${hash}`);
      console.log(`  status:  loaded`);
      if (traceId) {
        const policyResult = evaluateExecutionPolicy({
          task_kind: typeof args["kind"] === "string" ? args["kind"] as string : "generic",
          target: typeof args.target === "string" ? args.target : undefined,
          requested_by: (typeof args.requested_by === "string" ? args.requested_by : "manual") as any,
          is_replay: args.is_replay === "true",
          force: args.force === true,
          target_override: args.target_override === "true",
        });
        console.log(`  evaluation:`);
        console.log(`    trace_id:   ${traceId}`);
        console.log(`    task_kind:  ${typeof args["kind"] === "string" ? args["kind"] : "generic"}`);
        console.log(`    decision:   ${policyResult.decision}`);
        console.log(`    reason:     ${policyResult.reason}`);
      }
    }
    return;
  }

  if (args.preflight) {
    const traceId = args.preflight as string;
    const force = args.force === true;
    const targetOverride = typeof args.target === "string" ? args.target : undefined;
    const result = await checkRuntimePreflight({
      trace_id: traceId,
      mode: "replay",
      requested_by: "manual",
      force,
      target_override: targetOverride as any,
    });
    if (json) {
      console.log(JSON.stringify({ ok: true, ...result }));
    } else {
      console.log(`PREFLIGHT GATE`);
      console.log(`trace_id: ${result.trace_id}`);
      console.log(`mode:     ${result.mode}`);
      console.log(`overall:  ${result.overall.toUpperCase()}`);
      console.log();
      for (const c of result.checks) {
        const icon = c.status === "passed" ? "✓" : c.status === "warning" ? "⚠" : c.status === "blocked" ? "✗" : "–";
        console.log(`  ${icon} ${c.check}: ${c.message}`);
      }
      if (result.approval_required) {
        console.log(`\n  Requires approval before execution.`);
      }
    }
    return;
  }

  if (args["execute-approval"]) {
    const approvalId = args["execute-approval"] as string;
    const result = await executeApprovedReplay(approvalId);
    if (json) {
      console.log(JSON.stringify({ ok: result.status === "started", ...result }));
    } else {
      console.log(`EXECUTE APPROVED REPLAY`);
      console.log(`approval_id:       ${approvalId}`);
      console.log(`status:            ${result.status}`);
      if (result.replay_trace_id) console.log(`replay_trace_id:   ${result.replay_trace_id}`);
      if (result.reason) console.log(`reason:            ${result.reason}`);
    }
    return;
  }

  if (args.bundle) {
    const traceId = args.bundle as string;
    const existing = getArtifactBundle(traceId);
    if (existing.ok && args.bundle === traceId && !args.force) {
      if (json) {
        console.log(JSON.stringify({ ok: true, ...existing }));
      } else {
        console.log(`ARTIFACT BUNDLE (existing)`);
        console.log(`  path:     ${existing.path}`);
        console.log(`  files:    ${existing.manifest?.files.join(", ")}`);
      }
    } else {
      const result = await createArtifactBundle(traceId);
      if (json) {
        console.log(JSON.stringify({ ok: result.ok, ...result }));
      } else {
        if (!result.ok) {
          console.error(`Bundle failed: ${result.error}`);
          process.exit(1);
        }
        console.log(`ARTIFACT BUNDLE CREATED`);
        console.log(`  path:     ${result.path}`);
        console.log(`  files:    ${result.manifest?.files.join(", ")}`);
        console.log(`  evidence: ${result.manifest?.evidence_count}`);
        console.log(`  artifacts: ${result.manifest?.artifact_count}`);
      }
    }
    return;
  }

  if (args.improvements) {
    const statusFilter = typeof args.improvements === "string" ? args.improvements : undefined;
    const items = listImprovements(statusFilter as any);
    if (json) {
      console.log(JSON.stringify({ ok: true, improvements: items, count: items.length }));
    } else {
      console.log(`IMPROVEMENT REGISTRY (${items.length})`);
      if (items.length === 0) {
        console.log("  (none)");
      }
      for (const item of items) {
        console.log(`  ${item.improvement_id}`);
        console.log(`    proposal_type: ${item.proposal_type}`);
        console.log(`    priority:      ${item.priority}`);
        console.log(`    status:        ${item.status}`);
        console.log(`    title:         ${item.title}`);
        console.log(`    trace:         ${item.source_trace_id}`);
        console.log(`    approved_by:   ${item.approved_by}`);
        console.log(`    created:       ${item.created_at}`);
      }
    }
    return;
  }

  if (args["improvements-sync"]) {
    const items = registerAllApprovedProposals();
    if (json) {
      console.log(JSON.stringify({ ok: true, registered: items.length, improvements: items }));
    } else {
      console.log(`Improvements synced: ${items.length} registered from approved proposals`);
      for (const item of items) {
        console.log(`  ${item.improvement_id}: ${item.title} (${item.priority})`);
      }
    }
    return;
  }

  if (args.completion) {
    const traceId = args.completion as string;
    const { report, text } = await buildAndRenderCompletionReport(traceId);
    if (json) {
      console.log(JSON.stringify({ ok: !!report, trace_id: traceId, report }));
    } else {
      if (!report) {
        console.error(`Trace not found: ${traceId}`);
        process.exit(1);
      }
      console.log(text);
    }
    return;
  }

  const traceId = args.trace as string | undefined;
  if (!traceId) {
    console.error("Usage: npm run trace:inspect -- --trace <trace_id> [--living-loop] [--timeline] [--lineage] [--gates] [--retries] [--runtime] [--replay] [--replay-check] [--replay-run] [--force] [--target <rt>] [--json] [--list] [--preflight <trace_id>] [--execution-policy] [--execution-approvals] [--execution-approve <id>] [--execution-deny <id>] [--execution-consume <id>] [--freeze-create] [--freeze-compare] [--sweep-approvals] [--sweeper-status] [--sweeper-start] [--sweeper-stop] [--approval-audit] [--retention-status] [--retention-sweep] [--runtime-health] [--baseline-create] [--baseline-compare] [--drift-gate] [--completion <trace_id>] [--bundle <trace_id>] [--improvements] [--improvements-sync]");
    process.exit(1);
  }

  if (args["living-loop"]) {
    const inspection = inspectOperationalLoopTrace(traceId);
    if (json) {
      console.log(JSON.stringify({ ok: inspection.complete, inspection }, null, 2));
    } else {
      console.log(`LIVING LOOP TRACE`);
      console.log(`trace_id:  ${inspection.trace_id}`);
      console.log(`complete:  ${inspection.complete ? "yes" : "no"}`);
      console.log(`missing:   ${inspection.missing.length ? inspection.missing.join(", ") : "-"}`);
      for (const phase of inspection.phases) {
        console.log(`\n${phase.phase.toUpperCase()}: ${phase.present ? "present" : "missing"}`);
        for (const event of phase.events) {
          console.log(`  ${event.timestamp.slice(11, 19)} ${event.type} ${event.evidence_id}`);
        }
      }
    }
    return;
  }

  const summary = getTraceSummary(traceId);
  if (!summary) {
    const msg = `Trace not found: ${traceId}`;
    if (json) {
      console.log(JSON.stringify({ ok: false, error: msg }));
    } else {
      console.error(msg);
    }
    process.exit(1);
  }

  if (json) {
    await printJsonOutput(traceId, summary, args);
  } else {
    await printHumanOutput(traceId, summary, args);
  }
}

function formatTracesTable(traces: string[]): string {
  if (traces.length === 0) return "No traces found.";

  const lines: string[] = [];
  for (const traceId of traces) {
    const s = getTraceSummary(traceId);
    if (!s) continue;
    const artifacts = s.artifact_count ? ` artifacts=${s.artifact_count}` : "";
    const retries = s.retry_count ? ` retries=${s.retry_count}` : "";
    const gates = s.gates_failed ? ` gates_failed=${s.gates_failed}` : "";
    const healthIcon = healthIconMap(s.health);
    lines.push(
      `${healthIcon} ${s.trace_id.slice(0, 24).padEnd(24)} ` +
      `${s.health.padEnd(10)} ` +
      `${(s.runtime_target || "?").padEnd(12)} ` +
      `${s.status.padEnd(10)} ` +
      `${s.attempt} attempt${s.attempt > 1 ? "s" : ""}` +
      `${retries}${gates}${artifacts}`,
    );
  }
  return `TRACES (${traces.length})\n─\n${lines.join("\n")}`;
}

const healthIconMap: Record<string, string> = {
  healthy: "✓",
  warning: "⚠",
  failed: "✗",
  incomplete: "…",
  corrupt: "💥",
};

function formatHealth(health: string): string {
  const icon = healthIconMap[health] || "?";
  return `${icon} ${health}`;
}

function formatDuration(ms?: number): string {
  if (!ms) return "?";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

async function printHumanOutput(
  traceId: string,
  summary: ReturnType<typeof getTraceSummary>,
  args: Record<string, string | boolean>,
) {
  console.log(`TRACE SUMMARY`);
  console.log(`trace_id:  ${summary!.trace_id}`);
  console.log(`health:    ${formatHealth(summary!.health)}`);
  console.log(`job_id:    ${summary!.job_id}`);
  console.log(`task_id:   ${summary!.task_id || "-"}`);
  console.log(`status:    ${summary!.status}`);
  console.log(`runtime:   ${summary!.runtime_target || "-"}`);
  console.log(`attempts:  ${summary!.attempt}`);
  console.log(`duration:  ${formatDuration(summary!.duration_ms)}`);
  console.log(`events:    ${summary!.total_events}`);
  console.log(`gates:     ${summary!.gates_passed} passed, ${summary!.gates_failed} failed`);
  console.log(`retries:   ${summary!.retry_count}`);
  console.log(`fallback:  ${summary!.fallback_used ? "yes" : "no"}`);
  console.log(`artifacts: ${summary!.artifact_count}`);
  console.log(`input:     ${summary!.input_hash ? summary!.input_hash.slice(0, 16) + "…" : "-"}`);
  console.log(`output:    ${summary!.output_hash ? summary!.output_hash.slice(0, 16) + "…" : "-"}`);

  if (summary!.health_reasons.length > 0 && summary!.health_reasons[0] !== "all checks passed") {
    console.log(`\nHEALTH REASONS`);
    for (const r of summary!.health_reasons) {
      console.log(`  • ${r}`);
    }
  }

  if (args.timeline) {
    console.log(`\nTIMELINE`);
    const timeline = getTraceTimeline(traceId);
    for (const event of timeline) {
      const time = event.timestamp.slice(11, 19);
      const state = event.lifecycle_state ? ` [${event.lifecycle_state}]` : "";
      const target = event.runtime_target ? ` → ${event.runtime_target}` : "";
      const attempt = event.attempt ? ` (attempt ${event.attempt})` : "";
      console.log(`  ${time}  ${event.type}${state}${target}${attempt}`);
    }
  }

  if (args.lineage) {
    console.log(`\nLINEAGE`);
    const lineage = getTraceLineage(traceId);
    console.log(`  trace_id:        ${lineage.trace_id}`);
    if (lineage.parent_trace_id) console.log(`  parent_trace_id: ${lineage.parent_trace_id}`);
    if (lineage.replay_of) console.log(`  replay_of:       ${lineage.replay_of}`);
    if (lineage.children.length > 0) console.log(`  children:        ${lineage.children.join(", ")}`);
    if (lineage.replayed_by.length > 0) console.log(`  replayed_by:     ${lineage.replayed_by.join(", ")}`);
    if (lineage.linked_traces.length > 0) {
      console.log(`  linked_traces:`);
      for (const lt of lineage.linked_traces) {
        console.log(`    ${lt.trace_id} (${lt.relation})`);
      }
    }
  }

  if (args.gates) {
    const gates = getFailedGates(traceId);
    if (gates.length > 0) {
      console.log(`\nFAILED GATES`);
      for (const g of gates) {
        console.log(`  ✗ ${g.gate}${g.message ? ` — ${g.message}` : ""}`);
      }
    } else {
      console.log(`\nFAILED GATES: none`);
    }
  }

  if (args.retries) {
    const retries = getRetryHistory(traceId);
    if (retries.length > 0) {
      console.log(`\nRETRY HISTORY`);
      for (const r of retries) {
        console.log(`  #${r.attempt} reason=${r.reason} delay=${r.delay_ms}ms target=${r.target} at ${r.timestamp.slice(11, 19)}`);
      }
    } else {
      console.log(`\nRETRY HISTORY: none`);
    }
  }

  if (args.runtime) {
    console.log(`\nRUNTIME DECISION`);
    const decision = getRuntimeDecision(traceId);
    console.log(`  selected:   ${decision.selected || "-"}`);
    console.log(`  score:      ${decision.score ?? "-"}`);
    console.log(`  reasons:    ${decision.reasons?.join(", ") || "-"}`);
    console.log(`  fallback:   ${decision.fallback_chain?.join(" → ") || "-"}`);
    console.log(`  required:   ${decision.required_caps?.join(", ") || "-"}`);
  }

  if (args.replay) {
    const candidate = buildReplayCandidate(traceId);
    if (candidate) {
      console.log(`\nREPLAY CANDIDATE`);
      console.log(`  can_replay:         ${candidate.can_replay ? "yes" : "no"}`);
      console.log(`  replay_reason:      ${candidate.replay_reason}`);
      console.log(`  suggested_runtime:  ${candidate.suggested_runtime || "-"}`);
      if (candidate.failed_gates && candidate.failed_gates.length > 0) {
        console.log(`  failed_gates:       ${candidate.failed_gates.join(", ")}`);
      }
      const plan = planReplay(traceId);
      if (plan) {
        console.log(`\nREPLAY PLAN`);
        console.log(`  suggested_target:                ${plan.suggested_target}`);
        console.log(`  max_attempts:                    ${plan.max_attempts}`);
        console.log(`  skip_validation:                 ${plan.skip_validation}`);
        console.log(`  skip_capability_negotiation:     ${plan.skip_capability_negotiation}`);
        console.log(`  reason:                          ${plan.reason}`);
      }
    }
  }

  if (args["replay-check"]) {
    const force = args.force === true;
    const targetOverride = typeof args.target === "string" ? args.target : undefined;
    console.log(`\nREPLAY GOVERNANCE`);
    const governance = evaluateReplayGovernance({
      trace_id: traceId,
      requested_by: "manual",
      force,
      target_override: targetOverride as any,
    });
    console.log(`decision:         ${governance.decision}`);
    console.log(`reason:           ${governance.reason}`);
    console.log(`requires_human:   ${governance.requires_human ? "yes" : "no"}`);
    console.log(`allowed_with_force: ${governance.allowed_with_force ? "yes" : "no"}`);
  }

  if (args["replay-run"]) {
    const force = args.force === true;
    const targetOverride = typeof args.target === "string" ? args.target : undefined;
    console.log(`\nREPLAY EXECUTION`);
    console.log(`original_trace_id: ${traceId}`);
    const result = await executeReplay(traceId, {
      requested_by: "manual",
      force,
      target_override: targetOverride as any,
    });
    console.log(`status:           ${result.status}`);
    if (result.replay_trace_id) console.log(`replay_trace_id:  ${result.replay_trace_id}`);
    if (result.replay_job_id) console.log(`replay_job_id:    ${result.replay_job_id}`);
    if (result.reason) console.log(`reason:           ${result.reason}`);
  }

  console.log();
}

async function printJsonOutput(
  traceId: string,
  summary: ReturnType<typeof getTraceSummary>,
  args: Record<string, string | boolean>,
) {
  const output: Record<string, unknown> = { ok: true, trace_id: traceId, summary };

  if (args.timeline !== false) output.timeline = getTraceTimeline(traceId);
  if (args.lineage) output.lineage = getTraceLineage(traceId);
  if (args.gates) output.failed_gates = getFailedGates(traceId);
  if (args.retries) output.retry_history = getRetryHistory(traceId);
  if (args.runtime) output.runtime_decision = getRuntimeDecision(traceId);
  if (args.replay) {
    output.replay_candidate = buildReplayCandidate(traceId);
    output.replay_plan = planReplay(traceId);
  }
  if (args["replay-check"]) {
    output.replay_governance = evaluateReplayGovernance({
      trace_id: traceId,
      requested_by: "manual",
      force: args.force === true,
      target_override: typeof args.target === "string" ? args.target as any : undefined,
    });
  }
  if (args["replay-run"]) {
    output.replay_execution = executeReplay(traceId, {
      requested_by: "manual",
      force: args.force === true,
      target_override: typeof args.target === "string" ? args.target as any : undefined,
    });
  }

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error("CLI error:", err.message);
  process.exit(1);
});
