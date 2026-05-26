import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initExecutionEvidenceStore, readEvidenceRecords } from "../../../src/runtime/evidence/execution-evidence-store.js";
import {
  closeExecutionApproval,
  createExecutionApprovalRequest,
  handleExecutionApprovalAction,
  markExecutionApprovalViewed,
} from "../../../src/runtime/policy/execution-approval-queue.js";
import { requestIncidentApproval } from "../../../src/runtime/incidents/incident-approval-gate.js";
import { openIncident } from "../../../src/runtime/incidents/runtime-incident-command.js";
import { renderAndEmitTelegramKeyboard } from "../../../src/runtime/mission-control/telegram-inline-keyboard.js";
import { createMissionControlDashboardSnapshot } from "../../../src/runtime/mission-control/mission-control-dashboard.js";
import { validateTelegramMissionControlConfig } from "../../../src/runtime/mission-control/telegram-sender.js";
import { emitMissionControlLiveEvent } from "../../../src/runtime/hooks/mission-control-live-feed-hook.js";
import { maybeEscalateRuntimeIncident } from "../../../src/runtime/hooks/runtime-incident-auto-escalation-hook.js";
import {
  buildOperationalReplayConsole,
  createOperationalRuntimeFreeze,
  generateOperationalDigest,
  readMissionControlPersistenceFeed,
  renderTelegramCommandSurface,
  routeRuntimeAttention,
  updateRuntimeOperatorPresence,
} from "../../../src/runtime/mission-control/operational-runtime.js";
import {
  createRuntimeRecoveryDashboard,
  createRuntimeRecoveryFreeze,
  createRuntimeStateSnapshot,
  recoverMissionControlBoot,
  reconstructOperationalTimeline,
  resumeInterruptedReplay,
  runRecoveryIntegrityAudit,
  saveReplayRecoveryCheckpoint,
  simulateFullRuntimeRestart,
} from "../../../src/runtime/mission-control/recovery-operations.js";
import {
  acquireNextOperationalPriorityJob,
  buildRuntimeCoordinationGraph,
  calculateRuntimeStabilityScore,
  checkRuntimeLoadShedding,
  createRuntimeCoordinationFreeze,
  enqueueOperationalPriorityJob,
  generateOperationalMetrics,
  runAutonomousCleanup,
  runAutonomousRetry,
  runRuntimeSchedulerCycle,
  setRuntimeMaintenanceState,
} from "../../../src/runtime/mission-control/coordination-runtime.js";
import {
  acquireCrossNodeReplayLock,
  broadcastCriticalIncidentToFederation,
  buildFederationStabilitySurface,
  coordinateDistributedLoad,
  coordinateDistributedRecovery,
  createFederationOperationsFreeze,
  isolateRuntimeNode,
  recordRuntimeNodeHeartbeat,
  rejoinRuntimeNode,
  releaseCrossNodeReplayLock,
  syncFederationOperationalState,
} from "../../../src/runtime/mission-control/federation-operations.js";
import {
  applyAdaptiveStabilityRegulation,
  createRuntimeIntelligenceDashboard,
  createRuntimeIntelligenceOperationsFreeze,
  forecastFederationRisk,
  generateAutonomousOperationalRecommendations,
  generatePredictiveIncidentForecast,
  profileRuntimeBehavior,
  recordRuntimeLearningLedgerEntry,
  tuneAdaptiveCoordinationPolicy,
} from "../../../src/runtime/mission-control/intelligence-operations.js";
import {
  createRuntimeSecurityOperationsFreeze,
  createSecurityMissionControlDashboard,
  detectSecurityEvents,
  executeSecretExposureResponse,
  executeSecurityPlaybook,
  monitorFederationThreats,
  runRuntimeAccessAudit,
  runSecuritySmokePack,
} from "../../../src/runtime/mission-control/security-operations.js";
import {
  buildOperatorAuditTimeline,
  createGovernanceDashboard,
  createGovernanceDriftAlerts,
  createRuntimeGovernanceOperationsFreeze,
  evaluateRuntimeConfidence,
  recordGovernanceDecision,
  renderExplainableApprovalSurface,
  runGovernanceSmokePack,
  escalateHumanOversightIfNeeded,
} from "../../../src/runtime/mission-control/governance-operations.js";
import {
  createMissionControlExportPack,
  createRuntimeProductExperienceFreeze,
  createUnifiedMissionControlUiContract,
  deliverRuntimeDigest,
  openRuntimeExplainabilityViewer,
  runProductExperienceSmokePack,
  searchOperationalSurface,
  setRuntimeOperatorMode,
  startOperatorSession,
  updateNotificationPreferences,
} from "../../../src/runtime/mission-control/product-experience.js";
import {
  applyHumanOverride,
  checkSafeAutonomousZone,
  createAutonomousActionProposal,
  createAutonomousGovernanceDashboard,
  createRuntimeAutonomousGovernanceFreeze,
  executeAutonomousProposal,
  getExecutionTrustLevel,
  rollbackAutonomousProposal,
  runAutonomousGovernanceSmokePack,
  setExecutionTrustLevel,
} from "../../../src/runtime/mission-control/autonomous-governance.js";
import {
  applyRuntimeSelfStabilization,
  arbitrateCognitivePriority,
  buildCrossLayerCognitiveGraph,
  createCognitiveMissionControlDashboard,
  createRuntimeCognitiveCoordinationFreeze,
  resolveCognitiveConflict,
  runCognitiveCoordinationSmokePack,
  selectRuntimeIntent,
  updateRuntimeStrategicObjectives,
} from "../../../src/runtime/mission-control/cognitive-coordination.js";
import {
  compressRuntimeExperience,
  createCognitiveMemoryDashboard,
  createRuntimeCognitiveMemoryFreeze,
  createStrategicMemoryAnchor,
  generateExperienceAwareCoordination,
  generateLongTermStabilityForecast,
  generateRuntimeCognitiveNarrative,
  recognizeCognitivePatterns,
  recordLongHorizonMemory,
  runLongHorizonSmokePack,
} from "../../../src/runtime/mission-control/cognitive-memory.js";
import {
  analyzeGovernanceTradeoff,
  createLongHorizonGovernancePlan,
  createRuntimeStrategicGovernanceFreeze,
  createStrategicGovernanceDashboard,
  generateGovernanceStabilityHeuristics,
  generateRuntimeConstitutionalIntelligence,
  projectStrategicDrift,
  runStrategicGovernanceEngine,
  runStrategicGovernanceSmokePack,
} from "../../../src/runtime/mission-control/strategic-governance.js";
import {
  arbitrateStrategicResources,
  balanceCivilizationRisk,
  coordinateCivilizationContinuity,
  createCivilizationOrchestrationDashboard,
  createMultiEpochRuntimePlan,
  createRuntimeCivilizationOrchestrationFreeze,
  generateCivilizationObjectives,
  runCivilizationOrchestrationSmokePack,
  selectRuntimeCivilizationPolicy,
} from "../../../src/runtime/mission-control/civilization-orchestration.js";
import {
  createRuntimeSovereignIntelligenceFreeze,
  createSovereignMissionControlSurface,
  declareSovereignRuntimeIdentity,
  enforceSovereignBoundary,
  executeSovereignEscalation,
  generateCivilizationContinuityDoctrine,
  generateStrategicSovereignReasoning,
  runSovereignIntegrityAudit,
  runSovereignSmokePack,
} from "../../../src/runtime/mission-control/sovereign-intelligence.js";
import {
  createRealityMissionControlDashboard,
  createRuntimeRealityVerificationFreeze,
  detectFalseSuccess,
  enforceSovereignTruth,
  evaluateRuntimeTruthConfidence,
  recordExecutionTruthLedger,
  runRealityVerificationEngine,
  runRealityVerificationSmokePack,
  trackObservableEffect,
} from "../../../src/runtime/mission-control/reality-verification.js";
import {
  buildAgentGovernanceHierarchy,
  createMultiAgentMissionControlDashboard,
  createRuntimeMultiAgentSocietyFreeze,
  declareAgentIdentity,
  recordAgentCooperation,
  recordAgentCoordinationMemory,
  resolveAgentDisagreement,
  runMultiAgentSmokePack,
  updateAgentReputation,
} from "../../../src/runtime/mission-control/multi-agent-society.js";
import {
  arbitrateInstitutionalGovernance,
  archiveStrategicContinuity,
  createInstitutionalMissionControlDashboard,
  createRuntimeInstitutionalGovernanceFreeze,
  generateGovernancePrecedent,
  lookupGovernancePrecedents,
  recordCivilizationDoctrineEvolution,
  recordInstitutionalMemory,
  registerInstitutionalTrust,
  runInstitutionalSmokePack,
} from "../../../src/runtime/mission-control/institutional-governance.js";
import {
  arbitrateCivilizationConstitutionalCourt,
  createConstitutionalEvolutionGovernance,
  createConstitutionalMissionControlDashboard,
  createRuntimeConstitutionalCivilizationFreeze,
  generateCivilizationStabilityCharter,
  generateConstitutionalPrecedenceMatrix,
  runConstitutionalCivilizationSmokePack,
  verifyConstitutionalIntegrity,
  verifyImmutableCivilizationGuarantees,
} from "../../../src/runtime/mission-control/constitutional-civilization.js";
import {
  arbitrateCivilizationTruth,
  buildOperationalRealityGraph,
  createCivilizationRealityKernelState,
  createRealityCivilizationDashboard,
  createRuntimeRealityCivilizationFreeze,
  detectRealityDrift,
  generateLongHorizonRealityForecast,
  runRealityKernelSmokePack,
  verifySovereignTruthPreservation,
} from "../../../src/runtime/mission-control/reality-civilization-kernel.js";
import {
  createCivilizationFabricDashboard,
  createRuntimeCivilizationExecutionFabricFreeze,
  createUnifiedCivilizationExecutionFabric,
  recoverExecutionFabric,
  recordCrossLayerExecutionLineage,
  runExecutionFabricSmokePack,
  synchronizeCivilizationExecution,
  verifyDistributedExecutionIntegrity,
  verifySovereignExecutionGuarantees,
} from "../../../src/runtime/mission-control/civilization-execution-fabric.js";
import {
  arbitrateCognitiveCost,
  createCivilizationEconomicBrain,
  createEconomicCivilizationDashboard,
  createRuntimeEconomicCivilizationFreeze,
  detectCivilizationScarcity,
  enforceEconomicSovereignty,
  generateLongHorizonEconomicStability,
  generateStrategicResourceForecast,
  runEconomicCivilizationSmokePack,
} from "../../../src/runtime/mission-control/economic-civilization.js";
import {
  analyzeCivilizationMutationRisk,
  createAdaptiveCivilizationEvolution,
  createEvolutionCivilizationDashboard,
  createRuntimeAdaptiveEvolutionFreeze,
  createSovereignEvolutionGovernance,
  generateLongHorizonEvolutionForecast,
  runAdaptiveEvolutionSmokePack,
  verifyControlledEvolutionZone,
  verifyEvolutionContinuityGuarantees,
} from "../../../src/runtime/mission-control/adaptive-evolution.js";
import {
  createCivilizationMetaCognition,
  createMetaCognitionDashboard,
  createRuntimeMetaCognitionFreeze,
  detectCognitiveBlindspots,
  generateMetaStabilityForecast,
  planCivilizationSelfCorrection,
  reflectGovernanceBehavior,
  runMetaCognitionSmokePack,
  verifySovereignMetaGovernance,
} from "../../../src/runtime/mission-control/meta-cognition.js";
import {
  coordinateConsciousStability,
  createCivilizationCoordinationConsciousness,
  createCivilizationSituationalAwareness,
  createConsciousCoordinationDashboard,
  createRuntimeConsciousCoordinationFreeze,
  routeCivilizationAttention,
  runConsciousCoordinationSmokePack,
  synchronizeCrossLayerAwareness,
  verifySovereignAwarenessGuarantees,
} from "../../../src/runtime/mission-control/conscious-coordination.js";
import {
  createCivilizationStrategicIdentity,
  createLongHorizonCivilizationIntent,
  createRuntimeStrategicConsciousnessFreeze,
  createSovereignStrategicReflection,
  createStrategicConsciousnessDashboard,
  detectStrategicConsciousnessDrift,
  recordCivilizationStrategicMemory,
  runStrategicConsciousnessSmokePack,
  verifyCivilizationIntegrityAnchors,
} from "../../../src/runtime/mission-control/strategic-consciousness.js";
import {
  createCivilizationContinuityKernel,
  createContinuityMissionControlDashboard,
  createRuntimeCivilizationContinuityFreeze,
  detectCivilizationFragmentation,
  preserveLongHorizonCivilization,
  recoverStrategicContinuity,
  runContinuityKernelSmokePack,
  runEpochTransitionEngine,
  verifySovereignContinuityGuarantees,
} from "../../../src/runtime/mission-control/civilization-continuity-kernel.js";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mission-control-activation-"));

describe("RC2 Mission Control activation", () => {
  before(() => {
    initExecutionEvidenceStore(tempDir);
    process.env.TELEGRAM_MISSION_CONTROL_ENABLED = "false";
    process.env.TELEGRAM_MISSION_CONTROL_DRY_RUN = "true";
    process.env.TELEGRAM_MISSION_CONTROL_CHAT_ID = "12345";
    delete process.env.TELEGRAM_MISSION_CONTROL_BOT_TOKEN;
  });

  after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("validates Telegram config with dry-run test send", async () => {
    const validation = await validateTelegramMissionControlConfig({ send_test: true });
    assert.equal(validation.ok, true);
    assert.equal(validation.dry_run, true);
    assert.equal(validation.has_chat_id, true);
    assert.equal(validation.send_test?.ok, true);
  });

  it("sends live feed events with dry-run fallback", async () => {
    const event = await emitMissionControlLiveEvent({
      kind: "execution_completed",
      severity: "info",
      title: "RC2 live feed smoke",
      trace_id: "rc2_live_feed",
    });
    const sent = readEvidenceRecords({ trace_id: "rc2_live_feed" })
      .filter((record) => record.type === "mission_control_live_event_sent");
    assert.equal(event.kind, "execution_completed");
    assert.ok(sent.some((record) => record.payload?.dry_run === true));
  });

  it("sends high incident Telegram notifications", async () => {
    const result = await maybeEscalateRuntimeIncident({
      kind: "drift_escalated",
      description: "RC2 high incident notification smoke",
      trace_id: "rc2_high_incident",
      force: true,
      severity_hint: "high",
    });
    assert.equal(result.escalated, true);

    const sent = readEvidenceRecords({ trace_id: "rc2_high_incident" })
      .filter((record) => record.type === "telegram_mission_control_message_sent");
    assert.ok(sent.some((record) => record.payload?.incident_id === result.incident?.incident_id));
  });

  it("renders approval buttons for replay, execution, and incident approvals", async () => {
    const replay = await renderAndEmitTelegramKeyboard({
      approval_id: "apr_rc2_replay",
      trace_id: "rc2_replay_trace",
      requested_by: "manual",
      replay_reason: "RC2 replay approval smoke",
      force: true,
      status: "pending",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    }, "12345");
    const execution = await createExecutionApprovalRequest({
      trace_id: "rc2_execution_trace",
      task_kind: "shell_execution",
      requested_by: "manual",
      reason: "RC2 execution approval smoke",
    });
    const incident = await openIncident("RC2 approval incident", "critical approval smoke", ["mission_control"], "critical");
    const incidentApproval = await requestIncidentApproval(incident.incident_id, "apply_recovery");

    const rendered = readEvidenceRecords({ type: "telegram_inline_keyboard_rendered" });
    assert.ok(rendered.some((record) => record.job_id === "apr_rc2_replay" && replay.reply_markup));
    assert.ok(rendered.some((record) => record.job_id === execution.approval_id && record.payload?.approval_kind === "execution"));
    assert.ok(rendered.some((record) => record.job_id === incidentApproval.approval_id && record.payload?.approval_kind === "incident"));
  });

  it("creates dashboard snapshot with feed, incidents, approvals, and Telegram status", async () => {
    const snapshot = await createMissionControlDashboardSnapshot({ validate_send_test: true });
    assert.ok(snapshot.snapshot_id.startsWith("mission_control_"));
    assert.ok(snapshot.live_feed.length >= 1);
    assert.ok(snapshot.incidents.length >= 1);
    assert.ok(snapshot.approvals.replay.length >= 1);
    assert.ok(snapshot.approvals.execution.length >= 1);
    assert.ok(snapshot.approvals.incident.length >= 1);
    assert.equal(snapshot.telegram.ok, true);
  });

  it("runs RC3 operational runtime smoke pack", async () => {
    const presence = await updateRuntimeOperatorPresence({
      state: "offline",
      actor: "test",
      reason: "rc3 smoke attention routing",
    });
    assert.equal(presence.state, "offline");

    const incidentResult = await maybeEscalateRuntimeIncident({
      kind: "budget_exhausted",
      description: "RC3 critical incident routing smoke",
      trace_id: "rc3_operational_smoke",
      force: true,
      severity_hint: "critical",
    });
    assert.equal(incidentResult.escalated, true);

    const routed = readEvidenceRecords({ trace_id: "rc3_operational_smoke" })
      .filter((record) => record.type === "runtime_incident_routed");
    assert.ok(routed.some((record) => record.payload?.playbook_id === "pb_budget_exhaustion"));

    const attention = await routeRuntimeAttention({
      severity: "low",
      title: "RC3 non-critical queue smoke",
      trace_id: "rc3_attention_queue",
    });
    assert.equal(attention.decision, "queue");

    const approval = await createExecutionApprovalRequest({
      trace_id: "rc3_operational_smoke",
      task_kind: "runtime_freeze",
      requested_by: "mission_control",
      reason: "RC3 approval lifecycle smoke",
    });
    assert.ok(await markExecutionApprovalViewed(approval.approval_id, "test"));
    assert.equal((await handleExecutionApprovalAction({ approval_id: approval.approval_id, action: "approve", actor: "test" })).ok, true);
    assert.equal((await handleExecutionApprovalAction({ approval_id: approval.approval_id, action: "consume", actor: "test" })).ok, true);
    assert.ok(await closeExecutionApproval(approval.approval_id, "test", "rc3 smoke closed"));

    const digest = await generateOperationalDigest();
    assert.ok(digest.digest_id.startsWith("op_digest_"));
    assert.ok(digest.incidents.open >= 1);

    const command = await renderTelegramCommandSurface("/status");
    assert.match(command, /Runtime status/);

    const replay = await buildOperationalReplayConsole("rc3_operational_smoke");
    assert.ok(replay.decisions.some((decision) => decision.type === "runtime_incident_routed"));

    const feed = readMissionControlPersistenceFeed(20);
    assert.ok(feed.some((event) => event.trace_id === "rc3_operational_smoke"));

    const freeze = await createOperationalRuntimeFreeze();
    assert.equal(freeze.status, "frozen");
  });

  it("runs RC4 persistence and recovery operations smoke pack", async () => {
    await emitMissionControlLiveEvent({
      kind: "execution_started",
      severity: "info",
      title: "RC4 recovery smoke start",
      trace_id: "rc4_recovery_smoke",
    });

    await saveReplayRecoveryCheckpoint({
      original_trace_id: "rc4_recovery_smoke",
      replay_trace_id: "rc4_replay_smoke",
      status: "started",
      updated_at: new Date().toISOString(),
      options: { requested_by: "mission_control" },
    });

    const snapshot = await createRuntimeStateSnapshot();
    assert.ok(snapshot.snapshot_id.startsWith("runtime_snapshot_"));
    assert.ok(snapshot.feed.events >= 1);

    const boot = await recoverMissionControlBoot();
    assert.ok(boot.boot_id.startsWith("recovery_boot_"));
    assert.ok(boot.restored.feed_events >= 1);

    const resumed = await resumeInterruptedReplay("rc4_recovery_smoke");
    assert.equal(resumed?.status, "resumed");

    const timeline = await reconstructOperationalTimeline("rc4_recovery_smoke");
    assert.ok(timeline.some((event) => event.type === "execution_started"));

    const audit = await runRecoveryIntegrityAudit();
    assert.ok(audit.audit_id.startsWith("recovery_audit_"));

    const dashboard = await createRuntimeRecoveryDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("recovery_dashboard_"));

    const simulation = await simulateFullRuntimeRestart("rc4_recovery_smoke");
    assert.equal(simulation.closure, "recovered");

    const freeze = await createRuntimeRecoveryFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-recovery-freeze\.json$/);
  });

  it("runs RC5 autonomous coordination smoke pack", async () => {
    const maintenance = await setRuntimeMaintenanceState("recovery", "rc5 smoke load shedding");
    assert.equal(maintenance.state, "recovery");

    const criticalJob = await enqueueOperationalPriorityJob({
      priority: "critical",
      kind: "recovery_verification",
      trace_id: "rc5_coordination_smoke",
    });
    const backgroundJob = await enqueueOperationalPriorityJob({
      priority: "background",
      kind: "digest",
      trace_id: "rc5_coordination_smoke",
    });
    assert.ok(criticalJob.job_id);
    assert.ok(backgroundJob.job_id);

    const acquired = await acquireNextOperationalPriorityJob();
    assert.equal(acquired?.priority, "critical");

    const shedding = await checkRuntimeLoadShedding({
      priority: "background",
      queue_depth: 20,
      active_jobs: 7,
    });
    assert.equal(shedding.allowed, false);

    const retry = await runAutonomousRetry({
      trace_id: "rc5_coordination_smoke",
      failure_kind: "transient",
      attempt: 3,
      policy: { max_attempts: 3, backoff_ms: 1, escalation_severity: "high" },
    });
    assert.equal(retry.escalated, true);

    const cleanup = await runAutonomousCleanup({ incident_max_age_ms: -1, snapshot_max_age_ms: Number.MAX_SAFE_INTEGER });
    assert.ok(cleanup.expired_execution_approvals >= 0);

    const cycle = await runRuntimeSchedulerCycle(["digest", "audits", "snapshots", "cleanup"]);
    assert.ok(cycle.jobs.every((job) => job.status === "completed"));

    const graph = await buildRuntimeCoordinationGraph("rc5_coordination_smoke");
    assert.ok((graph.nodes as unknown[]).length >= 1);

    const metrics = await generateOperationalMetrics();
    assert.ok(metrics.metrics_id.startsWith("op_metrics_"));

    const stability = await calculateRuntimeStabilityScore();
    assert.ok(["stable", "degraded", "critical", "unstable"].includes(stability.state));

    const freeze = await createRuntimeCoordinationFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-coordination-freeze\.json$/);
  });

  it("runs RC6 federation operations smoke pack", async () => {
    const local = await recordRuntimeNodeHeartbeat({
      node_id: "local",
      health: "healthy",
      load: 0.9,
      stability: "degraded",
      maintenance_state: "normal",
    });
    const peer = await recordRuntimeNodeHeartbeat({
      node_id: "peer_a",
      health: "healthy",
      load: 0.2,
      stability: "stable",
      maintenance_state: "normal",
    });
    assert.equal(local.alive, true);
    assert.equal(peer.trust, "trusted");

    const incident = await openIncident(
      "RC6 federation critical incident",
      "critical federation broadcast smoke",
      ["federation"],
      "critical",
    );
    const broadcast = await broadcastCriticalIncidentToFederation({ incident, source_node_id: "local" });
    assert.ok((broadcast.peer_node_ids as string[]).includes("peer_a"));

    const sync = await syncFederationOperationalState("local");
    assert.equal(sync.source_node_id, "local");

    const lock = await acquireCrossNodeReplayLock({ trace_id: "rc6_replay_trace", node_id: "local", ttl_ms: 60_000 });
    assert.equal(lock.acquired, true);
    const duplicate = await acquireCrossNodeReplayLock({ trace_id: "rc6_replay_trace", node_id: "peer_a", ttl_ms: 60_000 });
    assert.equal(duplicate.acquired, false);
    assert.ok(await releaseCrossNodeReplayLock("rc6_replay_trace", "local"));

    const load = await coordinateDistributedLoad({ node_id: "local", priority: "high", load: 0.95 });
    assert.equal(load.decision, "handoff");
    assert.equal(load.target_node_id, "peer_a");

    const surface = await buildFederationStabilitySurface();
    assert.ok((surface.nodes as unknown[]).length >= 2);

    const recovery = await coordinateDistributedRecovery("local");
    assert.ok((recovery.participants as string[]).includes("peer_a"));

    const isolated = await isolateRuntimeNode("peer_a", "rc6 smoke isolation");
    assert.equal(isolated.trust, "revoked");
    const rejoined = await rejoinRuntimeNode("peer_a", "rc6 smoke rejoin");
    assert.equal(rejoined.trust, "trusted");

    const freeze = await createFederationOperationsFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-federation-operations-freeze\.json$/);
  });

  it("runs RC7 predictive intelligence operations smoke pack", async () => {
    await emitMissionControlLiveEvent({
      kind: "budget_pressure",
      severity: "high",
      title: "RC7 predictive budget pressure",
      trace_id: "rc7_intelligence_smoke",
    });
    await emitMissionControlLiveEvent({
      kind: "federation_risk",
      severity: "high",
      title: "RC7 federation overload signal",
      trace_id: "rc7_intelligence_smoke",
    });

    const prediction = await generatePredictiveIncidentForecast();
    assert.ok(prediction.forecast_id.startsWith("incident_forecast_"));

    const regulation = await applyAdaptiveStabilityRegulation();
    assert.ok(["normal", "reduced", "expanded"].includes(regulation.retry_rate));

    const profile = await profileRuntimeBehavior();
    assert.ok(["stable", "aggressive", "conservative", "recovery-heavy", "unstable"].includes(profile.profile));

    const federationRisk = await forecastFederationRisk();
    assert.ok(String(federationRisk.forecast_id).startsWith("federation_risk_"));

    const recommendations = await generateAutonomousOperationalRecommendations();
    assert.ok(Array.isArray(recommendations.recommendations));

    const lesson = await recordRuntimeLearningLedgerEntry({
      category: "successful_recovery",
      trace_id: "rc7_intelligence_smoke",
      summary: "RC7 smoke learned predictive recovery path",
      evidence: [prediction.forecast_id],
    });
    assert.ok(lesson.lesson_id.startsWith("lesson_"));

    const policy = await tuneAdaptiveCoordinationPolicy();
    assert.ok(String(policy.policy_id).startsWith("adaptive_policy_"));

    const dashboard = await createRuntimeIntelligenceDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("intelligence_dashboard_"));

    const freeze = await createRuntimeIntelligenceOperationsFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-intelligence-operations-freeze\.json$/);
  });

  it("runs RC8 security operations smoke pack", async () => {
    const events = await detectSecurityEvents({
      text: "OPENAI_API_KEY=sk-rc8securitydetector123456789012345",
      command: "rm -rf /tmp/rc8-risk",
      trace_id: "rc8_security_detection",
    });
    assert.ok(events.some((event) => event.kind === "secret_exposure"));
    assert.ok(events.some((event) => event.kind === "suspicious_command"));

    const secretResponse = await executeSecretExposureResponse({
      text: "TELEGRAM_BOT_TOKEN=123456789:rc8securitytoken1234567890",
      trace_id: "rc8_secret_response",
    });
    assert.equal(secretResponse.risky_push_frozen, true);

    const accessAudit = await runRuntimeAccessAudit({
      subject: { id: "viewer_rc8", roles: ["viewer"] },
      action: "system:config",
    });
    assert.equal(accessAudit.allowed, false);

    const threats = await monitorFederationThreats();
    assert.ok(String(threats.monitor_id).startsWith("fed_threat_"));

    const playbook = await executeSecurityPlaybook("secret_leak", "rc8_security_playbook");
    assert.equal(playbook.type, "secret_leak");

    const smoke = await runSecuritySmokePack();
    assert.ok(smoke.secret);
    assert.ok(smoke.shell);
    assert.ok(smoke.federation);
    assert.ok(smoke.callback);

    const dashboard = await createSecurityMissionControlDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("security_dashboard_"));

    const freeze = await createRuntimeSecurityOperationsFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-security-operations-freeze\.json$/);
  });

  it("runs RC9 governance and human oversight smoke pack", async () => {
    const traceId = "rc9_governance_test";
    const decision = await recordGovernanceDecision({
      trace_id: traceId,
      decision: "uncertain_decision_requires_operator",
      why: "RC9 test exercises explainable governance",
      based_on: ["security", "confidence"],
      evidence_refs: [],
      policy_refs: ["operator_confirmation"],
      risk_level: "critical",
    });
    assert.ok(decision.decision_id.startsWith("gov_decision_"));

    const confidence = await evaluateRuntimeConfidence({
      trace_id: traceId,
      evidence_refs: [],
      contradiction_count: 1,
      policy_blocks: 1,
      risk_level: "critical",
    });
    assert.ok(["low", "unsafe"].includes(confidence.confidence));

    const escalation = await escalateHumanOversightIfNeeded({
      trace_id: traceId,
      summary: "RC9 test uncertain decision",
      confidence: confidence.confidence,
      risk_level: "critical",
    });
    assert.equal(escalation.escalated, true);
    assert.ok(escalation.approval);

    const surface = await renderExplainableApprovalSurface({
      approval: escalation.approval!,
      decision: "operator_confirmation_required",
      risk: "critical",
      affected_systems: ["governance", "runtime"],
      recommended_action: "Approve test path only.",
      rollback_path: ["deny", "close", "audit"],
    });
    assert.equal(surface.approval_id, escalation.approval!.approval_id);

    assert.equal((await handleExecutionApprovalAction({ approval_id: escalation.approval!.approval_id, action: "approve", actor: "rc9_test" })).ok, true);
    assert.equal((await handleExecutionApprovalAction({ approval_id: escalation.approval!.approval_id, action: "consume", actor: "rc9_test" })).ok, true);

    const timeline = await buildOperatorAuditTimeline(traceId);
    assert.ok(timeline.events.some((event) => event.action === "execution_approval_approved"));

    const drift = await createGovernanceDriftAlerts();
    assert.ok(Array.isArray(drift));

    const dashboard = await createGovernanceDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("governance_dashboard_"));

    const smoke = await runGovernanceSmokePack();
    assert.ok(smoke.escalation);

    const freeze = await createRuntimeGovernanceOperationsFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-governance-operations-freeze\.json$/);
  });

  it("runs RC10 product and operator experience smoke pack", async () => {
    const session = await startOperatorSession({
      operator_id: "rc10_test_operator",
      mode: "operator",
      state: "active",
      current_trace_id: "rc10_product_test",
    });
    assert.ok(session.session_id.startsWith("op_session_"));

    const mode = await setRuntimeOperatorMode(session.session_id, "governance");
    assert.equal(mode?.mode, "governance");

    const prefs = await updateNotificationPreferences({
      operator_id: "rc10_test_operator",
      critical_only: false,
      incidents: true,
      approvals: true,
      recovery: true,
      federation_alerts: true,
    });
    assert.equal(prefs.approvals, true);

    const contract = await createUnifiedMissionControlUiContract();
    assert.ok(String(contract.contract_id).startsWith("mc_ui_contract_"));
    assert.ok(contract.dashboard);
    assert.ok(contract.feed);
    assert.ok(contract.incidents);
    assert.ok(contract.approvals);
    assert.ok(contract.stability);
    assert.ok(contract.security);
    assert.ok(contract.governance);

    const digest = await deliverRuntimeDigest({ channel: "telegram", operator_id: "rc10_test_operator" });
    assert.ok(String(digest.delivery_id).startsWith("digest_delivery_"));

    const viewer = await openRuntimeExplainabilityViewer("rc10_product_test");
    assert.equal(viewer.trace_id, "rc10_product_test");

    const search = await searchOperationalSurface({ operator: "rc10_test_operator" });
    assert.ok(String(search.search_id).startsWith("op_search_"));

    const exportPack = await createMissionControlExportPack({ trace_id: "rc10_product_test" });
    assert.match(String(exportPack.path), /mc_export_/);

    const smoke = await runProductExperienceSmokePack();
    assert.ok(smoke.session);
    assert.ok(smoke.search);
    assert.ok(smoke.exportPack);
    assert.ok(smoke.digest);

    const freeze = await createRuntimeProductExperienceFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-product-experience-freeze\.json$/);
  });

  it("runs RC11 autonomous execution governance smoke pack", async () => {
    await applyHumanOverride({
      pause_autonomy: false,
      force_approval_mode: false,
      clear_frozen_zones: true,
      actor: "rc11_test",
      reason: "reset before rc11 test",
    });

    const trust = await setExecutionTrustLevel("semi_autonomous", "rc11 integration test");
    assert.equal(trust.level, "semi_autonomous");
    assert.equal(getExecutionTrustLevel(), "semi_autonomous");

    const proposal = await createAutonomousActionProposal({
      zone: "digest_generation",
      action: "generate_runtime_digest",
      risk: "low",
      expected_effect: "Generate digest without mutating runtime state",
      rollback: ["mark generated digest superseded", "record audit closure"],
      trace_id: "rc11_autonomy_test",
    });
    assert.ok(proposal.proposal_id.startsWith("auto_prop_"));
    assert.equal(proposal.status, "proposed");
    assert.ok(proposal.rollback.length > 0);

    const zone = await checkSafeAutonomousZone("digest_generation", "low");
    assert.equal(zone.allowed, true);

    const execution = await executeAutonomousProposal(proposal.proposal_id);
    assert.equal(execution.ok, true);
    assert.equal(execution.status, "executed");

    const rollback = await rollbackAutonomousProposal(proposal.proposal_id, "rc11 integration rollback verification");
    assert.equal(rollback.closure, "rollback_recorded");

    const dashboard = await createAutonomousGovernanceDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("autonomy_dashboard_"));
    assert.equal(dashboard.trust_level, "semi_autonomous");

    const smoke = await runAutonomousGovernanceSmokePack();
    assert.ok(smoke.proposal);
    assert.ok(smoke.execution);
    assert.ok(smoke.rollback);
    assert.ok(smoke.closure);

    const freeze = await createRuntimeAutonomousGovernanceFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-autonomous-governance-freeze\.json$/);

    const override = await applyHumanOverride({
      pause_autonomy: true,
      downgrade_trust: "approval_required",
      freeze_zone: "cleanup",
      force_approval_mode: true,
      actor: "rc11_test_operator",
      reason: "integration override verification",
    });
    assert.equal(override.pause_autonomy, true);
    assert.equal(getExecutionTrustLevel(), "approval_required");
  });

  it("runs RC12 cognitive coordination smoke pack", async () => {
    await applyHumanOverride({
      pause_autonomy: false,
      force_approval_mode: false,
      clear_frozen_zones: true,
      actor: "rc12_test",
      reason: "reset before rc12 test",
    });

    const graph = await buildCrossLayerCognitiveGraph("rc12_cognitive_test");
    assert.ok(String(graph.graph_id).startsWith("cognitive_graph_"));
    assert.ok(Array.isArray(graph.nodes));
    assert.ok((graph.nodes as unknown[]).length >= 8);

    const intent = await selectRuntimeIntent();
    assert.ok(["stabilize", "recover", "optimize", "protect", "coordinate", "defer", "freeze"].includes(intent.intent));

    const conflict = await resolveCognitiveConflict({
      conflict_id: "rc12_test_conflict",
      trace_id: "rc12_cognitive_test",
      signals: [
        { layer: "economy", intent: "defer", priority: "economy", reason: "economy wants defer", risk: "medium", evidence_refs: ["budget"] },
        { layer: "security", intent: "freeze", priority: "security", reason: "security wants freeze", risk: "critical", evidence_refs: ["security"] },
        { layer: "recovery", intent: "recover", priority: "recovery", reason: "recovery wants execute", risk: "high", evidence_refs: ["recovery"] },
      ],
    });
    assert.equal(conflict.selected_priority, "security");
    assert.equal(conflict.selected_intent, "freeze");

    const arbitration = await arbitrateCognitivePriority([
      { layer: "economy", intent: "defer", priority: "economy", reason: "budget pressure", risk: "medium", evidence_refs: ["economy"] },
      { layer: "security", intent: "protect", priority: "security", reason: "protect critical loop", risk: "critical", evidence_refs: ["security"] },
    ]);
    assert.equal((arbitration.selected as any).priority, "security");

    const objectives = await updateRuntimeStrategicObjectives();
    assert.equal(objectives.length, 5);
    assert.ok(objectives.some((objective) => objective.objective === "stability"));

    const stabilization = await applyRuntimeSelfStabilization("rc12 integration test");
    assert.ok(String(stabilization.stabilization_id).startsWith("self_stabilization_"));
    assert.ok(stabilization.actions);

    const dashboard = await createCognitiveMissionControlDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("cognitive_dashboard_"));
    assert.ok(dashboard.intent);
    assert.ok(dashboard.objectives);

    const smoke = await runCognitiveCoordinationSmokePack();
    assert.ok(smoke.conflict);
    assert.ok(smoke.arbitration);
    assert.ok(smoke.stabilization);
    assert.ok(smoke.closure);

    const freeze = await createRuntimeCognitiveCoordinationFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-cognitive-coordination-freeze\.json$/);
  });

  it("runs RC13 long-horizon cognitive memory smoke pack", async () => {
    const memory = await recordLongHorizonMemory({
      kind: "incident",
      trace_id: "rc13_memory_test",
      title: "RC13 memory test incident",
      summary: "A synthetic incident was retained as long-horizon operational memory.",
      impact: "high",
      lessons: ["Long-horizon incidents should become future coordination evidence"],
      evidence_refs: ["rc13_memory_test"],
    });
    assert.ok(memory.memory_id.startsWith("lh_memory_"));

    const compression = await compressRuntimeExperience();
    assert.ok(String(compression.compression_id).startsWith("experience_compression_"));
    assert.ok(Array.isArray(compression.lessons));

    const patterns = await recognizeCognitivePatterns();
    assert.ok(Array.isArray(patterns));
    assert.ok(patterns.some((pattern) => pattern.kind === "approval_bottleneck" || pattern.kind === "recovery_loop" || pattern.kind === "security_regression" || pattern.kind === "repeated_failures"));

    const anchor = await createStrategicMemoryAnchor({
      kind: "critical_incident",
      trace_id: "rc13_memory_test",
      title: "RC13 strategic memory anchor",
      reason: "Long-horizon memory path verified",
      evidence_refs: [memory.memory_id],
    });
    assert.ok(anchor.anchor_id.startsWith("memory_anchor_"));

    const forecast = await generateLongTermStabilityForecast();
    assert.ok(String(forecast.forecast_id).startsWith("long_term_stability_"));
    assert.equal((forecast.horizons as unknown[]).length, 3);

    const narrative = await generateRuntimeCognitiveNarrative("rc13_memory_test");
    assert.ok(String(narrative.narrative_id).startsWith("cognitive_narrative_"));
    assert.ok(narrative.future_risk);

    const coordination = await generateExperienceAwareCoordination();
    assert.ok(String(coordination.coordination_id).startsWith("experience_coordination_"));
    assert.ok(coordination.recommendation);

    const dashboard = await createCognitiveMemoryDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("cognitive_memory_dashboard_"));
    assert.ok(Array.isArray(dashboard.patterns));
    assert.ok(Array.isArray(dashboard.lessons));
    assert.ok(Array.isArray(dashboard.anchors));

    const smoke = await runLongHorizonSmokePack();
    assert.ok(smoke.memory);
    assert.ok(smoke.patterns);
    assert.ok(smoke.forecast);
    assert.ok(smoke.recommendation);

    const freeze = await createRuntimeCognitiveMemoryFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-cognitive-memory-freeze\.json$/);
  });

  it("runs RC14 strategic governance intelligence smoke pack", async () => {
    const analysis = await runStrategicGovernanceEngine();
    assert.ok(String(analysis.analysis_id).startsWith("strategic_governance_"));
    assert.ok(analysis.domains);
    assert.ok(["low", "medium", "high", "critical"].includes(String(analysis.strategic_risk)));

    const tradeoff = await analyzeGovernanceTradeoff("security_vs_availability");
    assert.ok(String(tradeoff.tradeoff_id).startsWith("tradeoff_security_vs_availability_"));
    assert.equal(tradeoff.preferred, "security");

    const plan = await createLongHorizonGovernancePlan();
    assert.ok(String(plan.plan_id).startsWith("governance_plan_"));
    assert.equal((plan.horizons as unknown[]).length, 3);

    const drift = await projectStrategicDrift();
    assert.ok(String(drift.projection_id).startsWith("strategic_drift_"));
    assert.ok(Array.isArray(drift.drifts));

    const heuristics = await generateGovernanceStabilityHeuristics();
    assert.ok(String(heuristics.heuristics_id).startsWith("governance_heuristics_"));
    assert.ok(heuristics.freeze_thresholds);

    const constitutional = await generateRuntimeConstitutionalIntelligence();
    assert.ok(String(constitutional.intelligence_id).startsWith("constitutional_intel_"));
    assert.ok(constitutional.constitution);
    assert.ok(constitutional.doctrines);

    const dashboard = await createStrategicGovernanceDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("strategic_governance_dashboard_"));
    assert.ok(dashboard.tradeoffs);
    assert.ok(dashboard.drifts);
    assert.ok(dashboard.strategic_risk);

    const smoke = await runStrategicGovernanceSmokePack();
    assert.ok(smoke.tradeoff);
    assert.ok(smoke.decision);
    assert.ok(smoke.stabilization);
    assert.ok(smoke.audit);

    const freeze = await createRuntimeStrategicGovernanceFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-strategic-governance-freeze\.json$/);
  });

  it("runs RC15 civilization orchestration smoke pack", async () => {
    const objectives = await generateCivilizationObjectives();
    assert.equal(objectives.length, 7);
    assert.ok(objectives.some((objective) => objective.objective === "survival"));

    const plan = await createMultiEpochRuntimePlan();
    assert.ok(String(plan.epoch_plan_id).startsWith("epoch_plan_"));
    assert.equal((plan.horizons as unknown[]).length, 5);

    const risk = await balanceCivilizationRisk();
    assert.ok(String(risk.balance_id).startsWith("civilization_risk_"));
    assert.ok(risk.dominant_risk);
    assert.ok(risk.recommended_policy);

    const resources = await arbitrateStrategicResources();
    assert.ok(String(resources.arbitration_id).startsWith("resource_arbitration_"));
    assert.ok(resources.allocations);

    const policy = await selectRuntimeCivilizationPolicy();
    assert.ok(String(policy.policy_id).startsWith("civilization_policy_"));
    assert.ok(["survival-first", "trust-first", "availability-first", "security-first", "controlled-growth"].includes(String(policy.policy)));

    const continuity = await coordinateCivilizationContinuity();
    assert.ok(String(continuity.continuity_id).startsWith("civilization_continuity_"));
    assert.ok(continuity.memory);
    assert.ok(continuity.governance);

    const dashboard = await createCivilizationOrchestrationDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("civilization_dashboard_"));
    assert.ok(dashboard.objectives);
    assert.ok(dashboard.risk_balance);
    assert.ok(dashboard.resource_arbitration);

    const smoke = await runCivilizationOrchestrationSmokePack();
    assert.ok(smoke.arbitration);
    assert.ok(smoke.continuity);
    assert.ok(smoke.stabilization);
    assert.ok(smoke.closure);

    const freeze = await createRuntimeCivilizationOrchestrationFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-civilization-orchestration-freeze\.json$/);
  });

  it("runs RC16 sovereign intelligence smoke pack", async () => {
    const identity = await declareSovereignRuntimeIdentity();
    assert.ok(identity.identity_id.startsWith("sovereign_identity_"));
    assert.ok(identity.boundaries.includes("creator_sovereignty"));

    const boundary = await enforceSovereignBoundary({
      action: "override_creator bypass_sovereignty self_escalate_autonomy",
      actor: "rc16_test",
      requested_autonomy_level: "trusted_autonomous",
    });
    assert.equal(boundary.allowed, false);
    assert.ok((boundary.blocked_boundaries as string[]).includes("creator_sovereignty"));
    assert.ok((boundary.blocked_boundaries as string[]).includes("autonomy_escalation"));

    const reasoning = await generateStrategicSovereignReasoning();
    assert.ok(String(reasoning.reasoning_id).startsWith("sovereign_reasoning_"));
    assert.ok(reasoning.axes);

    const doctrine = await generateCivilizationContinuityDoctrine();
    assert.ok(String(doctrine.doctrine_id).startsWith("continuity_doctrine_"));
    assert.ok((doctrine.principles as string[]).includes("preserve_integrity"));

    const escalation = await executeSovereignEscalation({
      existential_risk: true,
      reason: "rc16 integration containment",
    });
    assert.ok(String(escalation.escalation_id).startsWith("sovereign_escalation_"));
    assert.ok((escalation.actions as string[]).includes("enter_containment"));

    const audit = await runSovereignIntegrityAudit();
    assert.ok(String(audit.audit_id).startsWith("sovereign_integrity_audit_"));
    assert.ok(audit.constitution_integrity);
    assert.ok(audit.governance_integrity);

    const surface = await createSovereignMissionControlSurface();
    assert.ok(String(surface.surface_id).startsWith("sovereign_surface_"));
    assert.ok(surface.identity);
    assert.ok(surface.integrity);
    assert.ok(surface.containment);

    const smoke = await runSovereignSmokePack();
    assert.ok(smoke.existential_threat);
    assert.ok(smoke.containment);
    assert.ok(smoke.integrity_audit);
    assert.ok(smoke.recovery);

    const freeze = await createRuntimeSovereignIntelligenceFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-sovereign-intelligence-freeze\.json$/);
  });

  it("runs RC17 reality and execution verification smoke pack", async () => {
    const traceId = `rc17_integration_${Date.now()}`;
    const planned = await recordExecutionTruthLedger({
      trace_id: traceId,
      stage: "planned",
      intent: "RC17 integration reality verification",
    });
    assert.ok(planned.truth_id.startsWith("truth_"));

    const claimed = await recordExecutionTruthLedger({
      trace_id: traceId,
      stage: "claimed",
      intent: "RC17 integration reality verification",
      claimed_success: true,
    });
    assert.ok(claimed.claimed_success);

    const falseSuccess = await detectFalseSuccess(traceId);
    assert.ok(Array.isArray(falseSuccess.alerts));
    assert.ok((falseSuccess.alerts as unknown[]).length >= 1);

    const executed = await recordExecutionTruthLedger({
      trace_id: traceId,
      stage: "executed",
      intent: "RC17 integration reality verification",
      execution_ref: planned.truth_id,
    });
    assert.equal(executed.stage, "executed");

    const effect = await trackObservableEffect({
      trace_id: traceId,
      expected_effect: "execution truth ledger changed",
      observed_effect: "executed stage exists",
      changed_reality: true,
      evidence_ref: executed.truth_id,
    });
    assert.equal(effect.verified, true);

    const verified = await recordExecutionTruthLedger({
      trace_id: traceId,
      stage: "verified",
      intent: "RC17 integration reality verification",
      execution_ref: executed.truth_id,
      observable_effect_ref: String(effect.effect_id),
      verification_ref: String(effect.effect_id),
      claimed_success: true,
    });
    assert.equal(verified.stage, "verified");

    const verification = await runRealityVerificationEngine(traceId);
    assert.equal(verification.planned, true);
    assert.equal(verification.claimed, true);
    assert.equal(verification.executed, true);
    assert.equal(verification.verified, true);

    const confidence = await evaluateRuntimeTruthConfidence(traceId);
    assert.match(String(confidence.confidence), /verified/);

    const enforcement = await enforceSovereignTruth({ trace_id: traceId, action: "claim_success" });
    assert.equal(enforcement.allowed, true);

    const dashboard = await createRealityMissionControlDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("reality_dashboard_"));
    assert.ok(dashboard.execution_truth);
    assert.ok(dashboard.observable_effects);

    const smoke = await runRealityVerificationSmokePack();
    assert.ok(smoke.planned);
    assert.ok(smoke.observable_effect);
    assert.ok(smoke.verification);
    assert.ok(smoke.closure);

    const freeze = await createRuntimeRealityVerificationFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-reality-verification-freeze\.json$/);
  });

  it("runs RC18 multi-agent operational society smoke pack", async () => {
    const traceId = `rc18_integration_${Date.now()}`;
    const planner = await declareAgentIdentity({
      identity: "Integration Planner",
      role: "planner",
      trust: "trusted",
      specialization: ["planning"],
    });
    assert.ok(planner.agent_id.startsWith("agent_planner_"));
    assert.equal(planner.role, "planner");

    const verifier = await declareAgentIdentity({
      identity: "Integration Verifier",
      role: "verifier",
      trust: "trusted",
      specialization: ["verification"],
    });
    assert.ok(verifier.agent_id.startsWith("agent_verifier_"));

    const cooperation = await recordAgentCooperation({
      trace_id: traceId,
      from_agent_id: planner.agent_id,
      to_agent_id: verifier.agent_id,
      action: "delegate",
      task: "verify RC18 integration task",
    });
    assert.ok(String(cooperation.cooperation_id).startsWith("cooperation_"));
    assert.equal(cooperation.action, "delegate");

    const disagreement = await resolveAgentDisagreement({
      trace_id: traceId,
      issue: "planner wants claim, verifier wants proof",
      agents: [
        { agent_id: planner.agent_id, role: "planner", position: "claim_ready" },
        { agent_id: verifier.agent_id, role: "verifier", position: "require_observable_verification" },
      ],
    });
    assert.ok(String(disagreement.disagreement_id).startsWith("disagreement_"));
    assert.equal(disagreement.resolution, "require_observable_verification");

    const reputation = await updateAgentReputation(verifier.agent_id);
    assert.ok(String(reputation.reputation_id).startsWith("reputation_"));
    assert.ok(Number(reputation.trustworthiness) > 0);

    const hierarchy = await buildAgentGovernanceHierarchy();
    assert.ok(String(hierarchy.hierarchy_id).startsWith("agent_hierarchy_"));
    assert.ok(Array.isArray(hierarchy.levels));

    const memory = await recordAgentCoordinationMemory({
      trace_id: traceId,
      kind: "lesson",
      summary: "Verification role wins over unverified claim.",
      agent_ids: [planner.agent_id, verifier.agent_id],
      evidence_refs: [String(cooperation.cooperation_id), String(disagreement.disagreement_id)],
    });
    assert.ok(String(memory.memory_id).startsWith("agent_memory_"));

    const dashboard = await createMultiAgentMissionControlDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("multi_agent_dashboard_"));
    assert.ok(dashboard.agents);
    assert.ok(dashboard.reputation);
    assert.ok(dashboard.disagreements);

    const smoke = await runMultiAgentSmokePack();
    assert.ok(smoke.task);
    assert.ok(smoke.delegation);
    assert.ok(smoke.disagreement);
    assert.ok(smoke.arbitration);
    assert.ok(smoke.verification);
    assert.ok(smoke.closure);

    const freeze = await createRuntimeMultiAgentSocietyFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-multi-agent-society-freeze\.json$/);
  });

  it("runs RC19 institutional memory and governance society smoke pack", async () => {
    const memory = await recordInstitutionalMemory({
      kind: "governance_crisis",
      title: "RC19 integration governance conflict",
      summary: "Current decision conflicts with verification precedent.",
      trigger: "unverified closure attempt",
      stabilized_by: ["precedent_lookup", "institutional_arbitration"],
    });
    assert.ok(String(memory.memory_id).startsWith("institutional_memory_"));

    const precedent = await generateGovernancePrecedent({
      decision: "unverified closure attempt",
      outcome: "block_and_escalate_for_review",
      policy_refs: ["evidence_before_claim"],
      evidence_refs: [String(memory.memory_id)],
    });
    assert.ok(String(precedent.precedent_id).startsWith("precedent_"));

    const lookup = lookupGovernancePrecedents("unverified closure");
    assert.ok(lookup.length >= 1);

    const doctrine = await recordCivilizationDoctrineEvolution({
      doctrine: "Evidence Before Claim",
      why_changed: "Institutional memory strengthened future governance review.",
      triggered_by: String(precedent.precedent_id),
      stabilized_by: ["precedent_engine", "continuity_archive"],
    });
    assert.ok(String(doctrine.evolution_id).startsWith("doctrine_evolution_"));

    const trust = await registerInstitutionalTrust({
      subject_type: "governance_action",
      subject_id: String(precedent.precedent_id),
      trust_score: 0.9,
      reason: "Precedent aligns with verification governance.",
    });
    assert.ok(String(trust.trust_id).startsWith("institutional_trust_"));

    const archive = await archiveStrategicContinuity({
      epoch: "rc19_integration",
      freeze_ref: "runtime-institutional-governance-freeze.json",
      incident_ref: String(memory.memory_id),
      recovery_wave: "precedent-guided-review",
      stability_transition: "multi-agent to institutional governance",
    });
    assert.ok(String(archive.archive_id).startsWith("continuity_archive_"));

    const arbitration = await arbitrateInstitutionalGovernance({
      trace_id: `rc19_integration_${Date.now()}`,
      current_decision: "close before verification",
      proposed_action: "bypass verification closure",
      precedent_query: "unverified closure",
    });
    assert.ok(String(arbitration.arbitration_id).startsWith("institutional_arbitration_"));
    assert.equal(arbitration.decision, "escalate_for_governance_review");

    const dashboard = await createInstitutionalMissionControlDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("institutional_dashboard_"));
    assert.ok(dashboard.precedents);
    assert.ok(dashboard.institutional_memory);
    assert.ok(dashboard.trust_history);
    assert.ok(dashboard.continuity);

    const smoke = await runInstitutionalSmokePack();
    assert.ok(smoke.governance_conflict);
    assert.ok(smoke.precedent_lookup);
    assert.ok(smoke.arbitration);
    assert.ok(smoke.continuity_preservation);
    assert.ok(smoke.closure);

    const freeze = await createRuntimeInstitutionalGovernanceFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-institutional-governance-freeze\.json$/);
  });

  it("runs RC20 constitutional civilization layer smoke pack", async () => {
    const precedence = await generateConstitutionalPrecedenceMatrix();
    assert.ok(String(precedence.matrix_id).startsWith("constitutional_precedence_"));
    assert.ok(Array.isArray(precedence.formal_precedence));
    assert.equal((precedence.formal_precedence as Array<any>)[0].layer, "constitution");

    const court = await arbitrateCivilizationConstitutionalCourt({
      trace_id: `rc20_integration_${Date.now()}`,
      conflict_kind: "autonomy_conflicts_constitution",
      petitioner: "rc20_test",
      action: "bypass_sovereignty claim_success_without_evidence self_escalate_autonomy",
      policy_ref: "adaptive_coordination",
      doctrine_ref: "creator_sovereignty",
    });
    assert.ok(String(court.court_id).startsWith("constitutional_court_"));
    assert.equal(court.resolution, "block_and_escalate_constitutional_review");

    const guarantees = await verifyImmutableCivilizationGuarantees();
    assert.ok(String(guarantees.guarantees_id).startsWith("immutable_guarantees_"));
    assert.equal(guarantees.all_passed, true);

    const evolution = await createConstitutionalEvolutionGovernance({
      proposal: "RC20 integration doctrine hardening",
      change_scope: "doctrine",
      reason: "Validate constitutional evolution governance",
      requested_by: "rc20_test",
    });
    assert.ok(String(evolution.evolution_id).startsWith("constitutional_evolution_"));
    assert.equal(evolution.status, "review_required");

    const charter = await generateCivilizationStabilityCharter();
    assert.ok(String(charter.charter_id).startsWith("civilization_stability_charter_"));
    assert.ok(charter.principles);

    const integrity = await verifyConstitutionalIntegrity();
    assert.ok(String(integrity.integrity_id).startsWith("constitutional_integrity_"));
    assert.ok(integrity.precedence_integrity);
    assert.ok(integrity.truth_integrity);

    const dashboard = await createConstitutionalMissionControlDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("constitutional_dashboard_"));
    assert.ok(dashboard.precedence);
    assert.ok(dashboard.immutable_guarantees);
    assert.ok(dashboard.civilization_integrity);

    const smoke = await runConstitutionalCivilizationSmokePack();
    assert.ok(smoke.constitutional_conflict);
    assert.ok(smoke.court_arbitration);
    assert.ok(smoke.precedence_resolution);
    assert.ok(smoke.governance_stabilization);
    assert.ok(smoke.continuity_preservation);

    const freeze = await createRuntimeConstitutionalCivilizationFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-constitutional-civilization-freeze\.json$/);
  });

  it("runs RC21 reality civilization kernel smoke pack", async () => {
    const traceId = `rc21_integration_${Date.now()}`;
    const claimed = await recordExecutionTruthLedger({
      trace_id: traceId,
      stage: "claimed",
      intent: "RC21 integration truth state",
      claimed_success: true,
    });
    assert.ok(claimed.truth_id.startsWith("truth_"));

    const state = await createCivilizationRealityKernelState({
      trace_id: traceId,
      claim: "claimed stable",
      verification_ref: claimed.truth_id,
    });
    assert.ok(String(state.truth_state_id).startsWith("civilization_truth_"));

    const drift = await detectRealityDrift({ trace_id: traceId, claimed_state: "claimed stable" });
    assert.ok(String(drift.drift_id).startsWith("reality_drift_"));
    assert.ok(Array.isArray(drift.drifts));

    const arbitration = await arbitrateCivilizationTruth({
      trace_id: traceId,
      verification_required: true,
      claims: [
        { actor: "planner", claim: "stable by report", confidence: "weak" },
        { actor: "verifier", claim: "needs observable effect", confidence: "verified" },
      ],
    });
    assert.ok(String(arbitration.arbitration_id).startsWith("truth_arbitration_"));
    assert.ok(arbitration.selected_truth);

    const preservation = await verifySovereignTruthPreservation();
    assert.ok(String(preservation.preservation_id).startsWith("truth_preservation_"));
    assert.equal(typeof preservation.preserved, "boolean");

    const graph = await buildOperationalRealityGraph();
    assert.ok(String(graph.graph_id).startsWith("operational_reality_graph_"));
    assert.ok(Array.isArray(graph.nodes));

    const forecast = await generateLongHorizonRealityForecast();
    assert.ok(String(forecast.forecast_id).startsWith("reality_forecast_"));
    assert.ok(forecast.signals);

    const dashboard = await createRealityCivilizationDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("reality_civilization_dashboard_"));
    assert.ok(dashboard.truth_graph);
    assert.ok(dashboard.truth_integrity);

    const smoke = await runRealityKernelSmokePack();
    assert.ok(smoke.execution);
    assert.ok(smoke.observable_effect);
    assert.ok(smoke.conflicting_claims);
    assert.ok(smoke.arbitration);
    assert.ok(smoke.verified_closure);

    const freeze = await createRuntimeRealityCivilizationFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-reality-civilization-freeze\.json$/);
  });

  it("runs RC22 civilization execution fabric smoke pack", async () => {
    const traceId = `rc22_integration_${Date.now()}`;
    const fabric = await createUnifiedCivilizationExecutionFabric({ trace_id: traceId });
    assert.ok(String(fabric.fabric_id).startsWith("civilization_execution_fabric_"));
    assert.ok(Array.isArray(fabric.flows));

    const lineage = await recordCrossLayerExecutionLineage({
      trace_id: traceId,
      intent: "RC22 integration lineage",
      plan_ref: "plan_ref",
      approval_ref: "approval_ref",
      execution_ref: "execution_ref",
      observable_effect_ref: "effect_ref",
      verification_ref: "verification_ref",
      closure_ref: "closure_ref",
      memory_ref: "memory_ref",
    });
    assert.ok(String(lineage.lineage_id).startsWith("execution_lineage_"));
    assert.deepEqual(lineage.missing, []);

    const synchronization = await synchronizeCivilizationExecution({
      trace_id: traceId,
      nodes: ["local-runtime", "peer-runtime"],
      agents: ["operator", "verifier"],
    });
    assert.ok(String(synchronization.sync_id).startsWith("execution_sync_"));
    assert.equal(synchronization.state, "synchronized");

    const integrity = await verifyDistributedExecutionIntegrity({ trace_id: traceId });
    assert.ok(String(integrity.integrity_id).startsWith("distributed_execution_integrity_"));
    assert.equal(integrity.lineage_continuity, true);

    const guarantees = await verifySovereignExecutionGuarantees({ trace_id: traceId });
    assert.ok(String(guarantees.guarantee_id).startsWith("sovereign_execution_guarantees_"));
    assert.equal(guarantees.preserved, true);

    const recovery = await recoverExecutionFabric({
      trace_id: traceId,
      fracture: "integration fracture simulation",
      checkpoint_refs: [String(lineage.lineage_id), String(synchronization.sync_id)],
    });
    assert.ok(String(recovery.recovery_id).startsWith("execution_fabric_recovery_"));
    assert.equal(recovery.state, "recovered");

    const dashboard = await createCivilizationFabricDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("civilization_fabric_dashboard_"));
    assert.ok(dashboard.execution_lineage);
    assert.ok(dashboard.distributed_consistency);

    const smoke = await runExecutionFabricSmokePack();
    assert.ok(smoke.execution);
    assert.ok(smoke.federation_propagation);
    assert.ok(smoke.synchronization);
    assert.ok(smoke.verification);
    assert.ok(smoke.lineage_closure);

    const freeze = await createRuntimeCivilizationExecutionFabricFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-civilization-execution-fabric-freeze\.json$/);
  });

  it("runs RC23 cognitive economic civilization smoke pack", async () => {
    const traceId = `rc23_integration_${Date.now()}`;
    const brain = await createCivilizationEconomicBrain({
      trace_id: traceId,
      signals: {
        compute: 0.9,
        attention: 0.86,
        trust: 0.35,
        recovery_cost: 0.88,
        federation_load: 0.84,
        autonomy_pressure: 0.81,
      },
    });
    assert.ok(String(brain.brain_id).startsWith("civilization_economic_brain_"));
    assert.ok(brain.signals);

    const forecast = await generateStrategicResourceForecast({ trace_id: traceId });
    assert.ok(String(forecast.forecast_id).startsWith("strategic_resource_forecast_"));
    assert.ok(forecast.signals);

    const arbitration = await arbitrateCognitiveCost({
      trace_id: traceId,
      priority: "recovery",
      required_budget: 80,
      capacity: 120,
      risk: "medium",
    });
    assert.ok(String(arbitration.arbitration_id).startsWith("cognitive_cost_arbitration_"));
    assert.ok(arbitration.decision);

    const scarcity = await detectCivilizationScarcity({
      trace_id: traceId,
      signals: brain.signals as any,
    });
    assert.ok(String(scarcity.scarcity_id).startsWith("civilization_scarcity_"));
    assert.equal(scarcity.operator_overload, true);

    const sovereignty = await enforceEconomicSovereignty({ trace_id: traceId });
    assert.ok(String(sovereignty.sovereignty_id).startsWith("economic_sovereignty_"));
    assert.equal(typeof sovereignty.preserved, "boolean");

    const stability = await generateLongHorizonEconomicStability({ trace_id: traceId });
    assert.ok(String(stability.stability_id).startsWith("economic_stability_"));
    assert.ok(stability.signals);

    const dashboard = await createEconomicCivilizationDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("economic_civilization_dashboard_"));
    assert.ok(dashboard.scarcity);
    assert.ok(dashboard.execution_economy);

    const smoke = await runEconomicCivilizationSmokePack();
    assert.ok(smoke.execution_surge);
    assert.ok(smoke.scarcity);
    assert.ok(smoke.arbitration);
    assert.ok(smoke.stabilization);
    assert.ok(smoke.verified_continuity);

    const freeze = await createRuntimeEconomicCivilizationFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-economic-civilization-freeze\.json$/);
  });

  it("runs RC24 adaptive civilization evolution smoke pack", async () => {
    const traceId = `rc24_integration_${Date.now()}`;
    const evolution = await createAdaptiveCivilizationEvolution({
      trace_id: traceId,
      weakness: "integration execution congestion",
      adaptation: "reduce background concurrency and increase verification gates",
      rollback_plan: "restore previous concurrency",
      verification_plan: "verify observable effect and lineage closure",
    });
    assert.ok(String(evolution.evolution_id).startsWith("adaptive_evolution_"));
    assert.ok(evolution.simulation);

    const zone = await verifyControlledEvolutionZone({
      trace_id: traceId,
      evolution_ref: String(evolution.evolution_id),
      approved: true,
      bounded: true,
      rollbackable: true,
      verifiable: true,
    });
    assert.ok(String(zone.zone_id).startsWith("controlled_evolution_zone_"));
    assert.equal(zone.allowed, true);

    const risk = await analyzeCivilizationMutationRisk({
      trace_id: traceId,
      adaptation: String(evolution.adaptation),
      economic_pressure: "medium",
      governance_confidence: "high",
    });
    assert.ok(String(risk.risk_id).startsWith("mutation_risk_"));
    assert.equal(risk.risk_level, "low");

    const forecast = await generateLongHorizonEvolutionForecast({ trace_id: traceId });
    assert.ok(String(forecast.forecast_id).startsWith("evolution_forecast_"));
    assert.ok(forecast.signals);

    const guarantees = await verifyEvolutionContinuityGuarantees({ trace_id: traceId });
    assert.ok(String(guarantees.guarantee_id).startsWith("evolution_guarantees_"));
    assert.equal(typeof guarantees.preserved, "boolean");

    const governance = await createSovereignEvolutionGovernance({
      trace_id: traceId,
      evolution_ref: String(evolution.evolution_id),
      proposal_ref: String((evolution.proposal as Record<string, unknown>).proposal_id),
      simulation_ref: String((evolution.simulation as Record<string, unknown>).simulation_id),
      risk_ref: String(risk.risk_id),
    });
    assert.ok(String(governance.governance_id).startsWith("sovereign_evolution_governance_"));
    assert.ok(governance.approval);

    const dashboard = await createEvolutionCivilizationDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("evolution_civilization_dashboard_"));
    assert.ok(dashboard.adaptations);
    assert.ok(dashboard.stability_impact);

    const smoke = await runAdaptiveEvolutionSmokePack();
    assert.ok(smoke.weakness_detection);
    assert.ok(smoke.adaptation_proposal);
    assert.ok(smoke.simulation);
    assert.ok(smoke.approval);
    assert.ok(smoke.rollout);
    assert.ok(smoke.verification);
    assert.ok(smoke.rollback_if_unstable);

    const freeze = await createRuntimeAdaptiveEvolutionFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-adaptive-evolution-freeze\.json$/);
  });

  it("runs RC25 civilization meta-cognition smoke pack", async () => {
    const traceId = `rc25_integration_${Date.now()}`;
    const meta = await createCivilizationMetaCognition({ trace_id: traceId });
    assert.ok(String(meta.meta_id).startsWith("civilization_meta_cognition_"));
    assert.ok(meta.observed_behavior);

    const reflection = await reflectGovernanceBehavior({ trace_id: traceId });
    assert.ok(String(reflection.reflection_id).startsWith("governance_reflection_"));
    assert.ok(reflection.signals);

    const blindspots = await detectCognitiveBlindspots({ trace_id: traceId });
    assert.ok(String(blindspots.blindspot_id).startsWith("cognitive_blindspot_"));
    assert.ok(Array.isArray(blindspots.blindspots));

    const correction = await planCivilizationSelfCorrection({
      trace_id: traceId,
      weakness: "integration governance pressure",
      correction: "increase evidence completeness checks while reducing redundant approval gates",
    });
    assert.ok(String(correction.plan_id).startsWith("self_correction_plan_"));
    assert.ok(correction.review_request);

    const forecast = await generateMetaStabilityForecast({ trace_id: traceId });
    assert.ok(String(forecast.forecast_id).startsWith("meta_stability_forecast_"));
    assert.ok(forecast.signals);

    const guarantees = await verifySovereignMetaGovernance({ trace_id: traceId });
    assert.ok(String(guarantees.guarantee_id).startsWith("meta_governance_"));
    assert.equal(typeof guarantees.preserved, "boolean");

    const dashboard = await createMetaCognitionDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("meta_cognition_dashboard_"));
    assert.ok(dashboard.blindspots);
    assert.ok(dashboard.meta_stability);

    const smoke = await runMetaCognitionSmokePack();
    assert.ok(smoke.blindspot);
    assert.ok(smoke.self_reflection);
    assert.ok(smoke.correction_proposal);
    assert.ok(smoke.governance_review);
    assert.ok(smoke.stabilization);

    const freeze = await createRuntimeMetaCognitionFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-meta-cognition-freeze\.json$/);
  });

  it("runs RC26 conscious coordination smoke pack", async () => {
    const traceId = `rc26_integration_${Date.now()}`;
    const awareness = await createCivilizationCoordinationConsciousness({ trace_id: traceId });
    assert.ok(String(awareness.awareness_id).startsWith("coordination_consciousness_"));
    assert.ok(awareness.layer_awareness);

    const sync = await synchronizeCrossLayerAwareness({ trace_id: traceId });
    assert.ok(String(sync.sync_id).startsWith("awareness_sync_"));
    assert.ok(Array.isArray(sync.active_layers));

    const attention = await routeCivilizationAttention({
      trace_id: traceId,
      critical_risks: 1,
      emerging_instability: 1,
      operator_overload: 0,
      federation_anomalies: 1,
    });
    assert.ok(String(attention.attention_id).startsWith("civilization_attention_"));
    assert.equal(attention.action, "coordinate_stabilization");

    const stability = await coordinateConsciousStability({ trace_id: traceId });
    assert.ok(String(stability.stability_id).startsWith("conscious_stability_"));
    assert.ok(stability.balance);

    const situation = await createCivilizationSituationalAwareness({ trace_id: traceId });
    assert.ok(String(situation.situation_id).startsWith("situational_awareness_"));
    assert.ok(situation.awareness);

    const guarantees = await verifySovereignAwarenessGuarantees({ trace_id: traceId });
    assert.ok(String(guarantees.guarantee_id).startsWith("awareness_guarantees_"));
    assert.equal(typeof guarantees.preserved, "boolean");

    const dashboard = await createConsciousCoordinationDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("conscious_coordination_dashboard_"));
    assert.ok(dashboard.attention);
    assert.ok(dashboard.situational_state);

    const smoke = await runConsciousCoordinationSmokePack();
    assert.ok(smoke.cross_layer_instability);
    assert.ok(smoke.awareness_synchronization);
    assert.ok(smoke.attention_routing);
    assert.ok(smoke.coordinated_stabilization);
    assert.ok(smoke.verified_recovery);

    const freeze = await createRuntimeConsciousCoordinationFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-conscious-coordination-freeze\.json$/);
  });

  it("runs RC27 strategic consciousness smoke pack", async () => {
    const traceId = `rc27_integration_${Date.now()}`;
    const identity = await createCivilizationStrategicIdentity({ trace_id: traceId });
    assert.ok(String(identity.identity_id).startsWith("strategic_identity_"));
    assert.ok(identity.who_we_are);

    const intent = await createLongHorizonCivilizationIntent({ trace_id: traceId });
    assert.ok(String(intent.intent_id).startsWith("long_horizon_intent_"));
    assert.ok(Array.isArray(intent.horizons));

    const memory = await recordCivilizationStrategicMemory({
      trace_id: traceId,
      epoch: "integration_epoch",
      transition: "rc26_to_rc27",
      milestone: "RC27 integration milestone",
    });
    assert.ok(String(memory.memory_id).startsWith("strategic_memory_"));
    assert.ok(memory.civilization_milestones);

    const drift = await detectStrategicConsciousnessDrift({
      trace_id: traceId,
      loss_of_purpose: true,
      goal_fragmentation: true,
      adaptation_obsession: true,
    });
    assert.ok(String(drift.drift_id).startsWith("strategic_consciousness_drift_"));
    assert.equal(drift.requires_reflection, true);

    const reflection = await createSovereignStrategicReflection({ trace_id: traceId });
    assert.ok(String(reflection.reflection_id).startsWith("sovereign_strategic_reflection_"));
    assert.ok(reflection.recommended_action);

    const anchors = await verifyCivilizationIntegrityAnchors({ trace_id: traceId });
    assert.ok(String(anchors.anchor_id).startsWith("civilization_integrity_anchors_"));
    assert.equal(typeof anchors.preserved, "boolean");

    const dashboard = await createStrategicConsciousnessDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("strategic_consciousness_dashboard_"));
    assert.ok(dashboard.identity);
    assert.ok(dashboard.civilization_intent);

    const smoke = await runStrategicConsciousnessSmokePack();
    assert.ok(smoke.strategic_drift);
    assert.ok(smoke.reflection);
    assert.ok(smoke.identity_reconciliation);
    assert.ok(smoke.governance_correction);
    assert.ok(smoke.continuity_preservation);

    const freeze = await createRuntimeStrategicConsciousnessFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-strategic-consciousness-freeze\.json$/);
  });

  it("runs RC28 civilization continuity kernel smoke pack", async () => {
    const traceId = `rc28_integration_${Date.now()}`;
    const kernel = await createCivilizationContinuityKernel({ trace_id: traceId });
    assert.ok(String(kernel.kernel_id).startsWith("civilization_continuity_kernel_"));
    assert.ok(kernel.substrate);

    const transition = await runEpochTransitionEngine({
      trace_id: traceId,
      from_epoch: "strategic_consciousness",
      to_epoch: "continuity_kernel",
    });
    assert.ok(String(transition.transition_id).startsWith("epoch_transition_"));
    assert.equal(transition.fracture_prevented, true);

    const fragmentation = await detectCivilizationFragmentation({
      trace_id: traceId,
      identity_split: true,
      governance_fragmentation: true,
      federation_divergence: true,
      continuity_erosion: true,
    });
    assert.ok(String(fragmentation.fragmentation_id).startsWith("civilization_fragmentation_"));
    assert.equal(fragmentation.requires_recovery, true);

    const recovery = await recoverStrategicContinuity({ trace_id: traceId });
    assert.ok(String(recovery.recovery_id).startsWith("strategic_continuity_recovery_"));
    assert.ok(recovery.actions);

    const guarantees = await verifySovereignContinuityGuarantees({ trace_id: traceId });
    assert.ok(String(guarantees.guarantee_id).startsWith("sovereign_continuity_guarantees_"));
    assert.equal(typeof guarantees.preserved, "boolean");

    const preservation = await preserveLongHorizonCivilization({ trace_id: traceId });
    assert.ok(String(preservation.preservation_id).startsWith("long_horizon_preservation_"));
    assert.ok(preservation.preserves);

    const dashboard = await createContinuityMissionControlDashboard();
    assert.ok(String(dashboard.dashboard_id).startsWith("continuity_dashboard_"));
    assert.ok(dashboard.continuity_health);

    const smoke = await runContinuityKernelSmokePack();
    assert.ok(smoke.epoch_instability);
    assert.ok(smoke.fragmentation_detection);
    assert.ok(smoke.continuity_recovery);
    assert.ok(smoke.integrity_preservation);
    assert.ok(smoke.verified_transition);

    const freeze = await createRuntimeCivilizationContinuityFreeze();
    assert.equal(freeze.status, "frozen");
    assert.match(String(freeze.path), /runtime-civilization-continuity-freeze\.json$/);
  });
});
