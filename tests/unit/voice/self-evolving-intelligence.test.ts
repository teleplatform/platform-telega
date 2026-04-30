import assert from "node:assert/strict";

// ============================================================================
// Test harness
// ============================================================================
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message || e}`);
  }
}

// ============================================================================
// V8.5 — Voice Mission Knowledge Extraction
// ============================================================================
console.log("\n🧠 V8.5 — Voice Mission Knowledge Extraction");

import {
  extractMissionKnowledge,
  validateMissionKnowledge,
  formatVoiceMissionKnowledge,
  registerVoiceMissionKnowledge,
  getVoiceMissionKnowledge,
  getKnowledgeForMission,
  getHighReusabilityKnowledge,
  clearVoiceMissionKnowledgeRegistry,
} from "../../../src/telegram/voiceMissionKnowledgeExtraction.js";

import {
  createVoiceGovernanceMission,
  activateMission,
  completeMission,
} from "../../../src/telegram/voiceMissionModel.js";

import {
  buildVoiceMissionExecutionGraph,
  startGraphNode,
  completeGraphNode,
  failGraphNode,
} from "../../../src/telegram/voiceMissionExecutionGraph.js";

import {
  evaluateVoiceMissionSupervisor,
} from "../../../src/telegram/voiceMissionSupervision.js";

test("extracts successful sequence patterns", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });
  const activated = activateMission(mission);
  const completed = completeMission(activated);

  const { graph } = buildVoiceMissionExecutionGraph({
    mission: completed,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "Observe" },
      { domainId: "domain_1", actionType: "validate", description: "Validate", dependsOn: [0] },
      { domainId: "domain_1", actionType: "adapt", description: "Adapt", dependsOn: [1] },
    ],
  });

  // Complete all nodes
  const g1 = startGraphNode(graph, graph.nodes[0].nodeId);
  const g2 = completeGraphNode(g1, graph.nodes[0].nodeId);
  const g3 = startGraphNode(g2, graph.nodes[1].nodeId);
  const g4 = completeGraphNode(g3, graph.nodes[1].nodeId);
  const g5 = startGraphNode(g4, graph.nodes[2].nodeId);
  const g6 = completeGraphNode(g5, graph.nodes[2].nodeId);

  const supervisor = evaluateVoiceMissionSupervisor({
    mission: completed,
    graphId: graph.graphId,
    nodes: g6.nodes,
    graphProgress: 100,
    graphStatus: "completed",
    domainHealthScores: { domain_1: 90 },
    elapsedMs: 5000,
    expectedDurationMs: 60000,
  });

  const { knowledge } = extractMissionKnowledge({
    mission: completed,
    graph: g6,
    supervisor,
    recoveryTriggered: false,
    replanTriggered: false,
  });

  const successPatterns = knowledge.extractedPatterns.filter(
    (p) => p.type === "successful_sequence",
  );
  assert.ok(successPatterns.length > 0);
});

test("extracts failure patterns", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "recover_from_crisis",
    targetDomains: ["domain_1"],
  });
  const activated = activateMission(mission);

  const { graph } = buildVoiceMissionExecutionGraph({
    mission: activated,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "Observe" },
      { domainId: "domain_1", actionType: "stabilize", description: "Stabilize", dependsOn: [0] },
    ],
  });

  // Fail the first node
  const failedGraph = failGraphNode(graph, graph.nodes[0].nodeId, "Timeout");

  const { knowledge } = extractMissionKnowledge({
    mission: activated,
    graph: failedGraph,
    recoveryTriggered: true,
    replanTriggered: false,
    detectedRisks: [
      { type: "domain_overload", severity: 70, description: "Domain health critical", detectedAt: Date.now() },
    ],
  });

  const failurePatterns = knowledge.extractedPatterns.filter(
    (p) => p.type === "failure_pattern",
  );
  assert.ok(failurePatterns.length > 0);
});

test("extracts optimal dependency patterns", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });
  const activated = activateMission(mission);
  const completed = completeMission(activated);

  const { graph } = buildVoiceMissionExecutionGraph({
    mission: completed,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "Observe" },
      { domainId: "domain_1", actionType: "validate", description: "Validate A", dependsOn: [0] },
      { domainId: "domain_1", actionType: "adapt", description: "Adapt A", dependsOn: [0] },
      { domainId: "domain_1", actionType: "review", description: "Review", dependsOn: [1, 2] },
    ],
  });

  // Complete all nodes
  let g = graph;
  for (let i = 0; i < g.nodes.length; i++) {
    const started = startGraphNode(g, g.nodes[i].nodeId);
    g = completeGraphNode(started, g.nodes[i].nodeId);
  }

  const { knowledge } = extractMissionKnowledge({
    mission: completed,
    graph: g,
    recoveryTriggered: false,
    replanTriggered: false,
  });

  const depPatterns = knowledge.extractedPatterns.filter(
    (p) => p.type === "optimal_dependency",
  );
  // Node 0 (observe) should be a critical dependency
  assert.ok(depPatterns.length > 0);
});

test("knowledge registry stores records", () => {
  clearVoiceMissionKnowledgeRegistry();
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });
  const activated = activateMission(mission);
  const completed = completeMission(activated);

  const { graph } = buildVoiceMissionExecutionGraph({
    mission: completed,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "Observe" },
    ],
  });

  const { knowledge } = extractMissionKnowledge({
    mission: completed,
    graph,
    recoveryTriggered: false,
    replanTriggered: false,
  });

  registerVoiceMissionKnowledge(knowledge);
  const retrieved = getVoiceMissionKnowledge(knowledge.knowledgeId);
  assert.ok(retrieved);
  assert.equal(retrieved?.knowledgeId, knowledge.knowledgeId);
});

test("getHighReusabilityKnowledge filters by score", () => {
  clearVoiceMissionKnowledgeRegistry();
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });
  const activated = activateMission(mission);
  const completed = completeMission(activated);

  const { graph } = buildVoiceMissionExecutionGraph({
    mission: completed,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "Observe" },
      { domainId: "domain_1", actionType: "adapt", description: "Adapt", dependsOn: [0] },
    ],
  });

  let g = graph;
  for (let i = 0; i < g.nodes.length; i++) {
    const started = startGraphNode(g, g.nodes[i].nodeId);
    g = completeGraphNode(started, g.nodes[i].nodeId);
  }

  const { knowledge } = extractMissionKnowledge({
    mission: completed,
    graph: g,
    supervisor: { missionHealthScore: 85 } as any,
    recoveryTriggered: false,
    replanTriggered: false,
  });

  registerVoiceMissionKnowledge(knowledge);
  const highReuse = getHighReusabilityKnowledge(60);
  assert.ok(highReuse.length > 0);
});

test("validation catches invalid knowledge", () => {
  const errors = validateMissionKnowledge({
    missionId: "",
    extractedPatterns: [],
  });
  assert.ok(errors.includes("invalid_mission_id"));
  assert.ok(errors.includes("no_patterns_extracted"));
});

test("formatVoiceMissionKnowledge produces output", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });
  const activated = activateMission(mission);
  const completed = completeMission(activated);

  const { graph } = buildVoiceMissionExecutionGraph({
    mission: completed,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "Observe" },
    ],
  });

  const { knowledge } = extractMissionKnowledge({
    mission: completed,
    graph,
    recoveryTriggered: false,
    replanTriggered: false,
  });

  const formatted = formatVoiceMissionKnowledge(knowledge);
  assert.ok(formatted.includes("Voice Mission Knowledge"));
});

// ============================================================================
// V8.6 — Voice Mission Template Library
// ============================================================================
console.log("\n📋 V8.6 — Voice Mission Template Library");

import {
  createVoiceMissionTemplate,
  validateMissionTemplate,
  verifyVoiceMissionTemplate,
  findMatchingTemplates,
  recordTemplateUsage,
  formatVoiceMissionTemplate,
  registerVoiceMissionTemplate,
  getVoiceMissionTemplate,
  getVerifiedTemplates,
  getTemplatesByType,
  clearVoiceMissionTemplateRegistry,
} from "../../../src/telegram/voiceMissionTemplateLibrary.js";

test("creates template from knowledge", () => {
  clearVoiceMissionKnowledgeRegistry();
  clearVoiceMissionTemplateRegistry();

  // Create some knowledge records first
  const knowledgeRecords: import("../../../src/telegram/voiceMissionKnowledgeExtraction.js").VoiceMissionKnowledge[] = [];

  for (let i = 0; i < 3; i++) {
    const { mission } = createVoiceGovernanceMission({
      missionType: "stabilize_system",
      targetDomains: [`domain_${i}`],
    });
    const activated = activateMission(mission);
    const completed = completeMission(activated);

    const { graph } = buildVoiceMissionExecutionGraph({
      mission: completed,
      nodeTemplates: [
        { domainId: `domain_${i}`, actionType: "observe", description: `Observe ${i}` },
        { domainId: `domain_${i}`, actionType: "adapt", description: `Adapt ${i}`, dependsOn: [0] },
      ],
    });

    let g = graph;
    for (let j = 0; j < g.nodes.length; j++) {
      const started = startGraphNode(g, g.nodes[j].nodeId);
      g = completeGraphNode(started, g.nodes[j].nodeId);
    }

    const { knowledge } = extractMissionKnowledge({
      mission: completed,
      graph: g,
      recoveryTriggered: false,
      replanTriggered: false,
    });

    registerVoiceMissionKnowledge(knowledge);
    knowledgeRecords.push(knowledge);
  }

  const { template, validationErrors } = createVoiceMissionTemplate({
    knowledgeRecords,
    minPatternConfidence: 50,
    minReusabilityScore: 60,
  });

  assert.equal(validationErrors.length, 0);
  assert.ok(template.templateId.startsWith("voice_template_"));
  assert.equal(template.basedOnKnowledgeIds.length, 3);
  assert.ok(template.graphSkeleton.nodes.length >= 0);
});

test("verifies template with enough missions", () => {
  clearVoiceMissionKnowledgeRegistry();
  clearVoiceMissionTemplateRegistry();

  const knowledgeRecords: import("../../../src/telegram/voiceMissionKnowledgeExtraction.js").VoiceMissionKnowledge[] = [];

  for (let i = 0; i < 5; i++) {
    const { mission } = createVoiceGovernanceMission({
      missionType: "stabilize_system",
      targetDomains: ["domain_1"],
    });
    const activated = activateMission(mission);
    const completed = completeMission(activated);

    const { graph } = buildVoiceMissionExecutionGraph({
      mission: completed,
      nodeTemplates: [
        { domainId: "domain_1", actionType: "observe", description: "Observe" },
      ],
    });

    const { knowledge } = extractMissionKnowledge({
      mission: completed,
      graph,
      recoveryTriggered: false,
      replanTriggered: false,
    });

    registerVoiceMissionKnowledge(knowledge);
    knowledgeRecords.push(knowledge);
  }

  const { template } = createVoiceMissionTemplate({
    knowledgeRecords,
    minPatternConfidence: 50,
    minReusabilityScore: 60,
  });

  const verified = verifyVoiceMissionTemplate(template, []);
  assert.equal(verified.verificationStatus, "verified");
});

test("finds matching templates", () => {
  clearVoiceMissionTemplateRegistry();

  const { template } = createVoiceMissionTemplate({
    knowledgeRecords: [
      {
        knowledgeId: "k1",
        missionId: "m1",
        extractedPatterns: [],
        domainCoverage: ["domain_1"],
        reusabilityScore: 80,
        createdAt: Date.now(),
        missionType: "stabilize_system",
        missionOutcome: "completed",
        finalHealthScore: 85,
        totalNodes: 2,
        completedNodes: 2,
        failedNodes: 0,
        recoveryTriggered: false,
        replanTriggered: false,
        extractionConfidence: 70,
        evidenceStrength: 60,
      },
    ],
    minPatternConfidence: 50,
    minReusabilityScore: 60,
  });

  registerVoiceMissionTemplate(template);

  const matches = findMatchingTemplates(
    [template],
    {
      missionType: "stabilize_system",
      environmentContext: "production",
      riskLevel: "low",
      targetDomains: ["domain_1"],
    },
  );

  assert.equal(matches.length, 1);
  assert.ok(matches[0].matchScore >= 50);
});

test("recordTemplateUsage updates success rate", () => {
  const { template } = createVoiceMissionTemplate({
    knowledgeRecords: [
      {
        knowledgeId: "k1",
        missionId: "m1",
        extractedPatterns: [],
        domainCoverage: ["domain_1"],
        reusabilityScore: 80,
        createdAt: Date.now(),
        missionType: "stabilize_system",
        missionOutcome: "completed",
        finalHealthScore: 85,
        totalNodes: 2,
        completedNodes: 2,
        failedNodes: 0,
        recoveryTriggered: false,
        replanTriggered: false,
        extractionConfidence: 70,
        evidenceStrength: 60,
      },
    ],
    minPatternConfidence: 50,
    minReusabilityScore: 60,
  });

  const used = recordTemplateUsage(template, "completed");
  assert.equal(used.usageCount, 1);

  const usedAgain = recordTemplateUsage(used, "aborted");
  assert.equal(usedAgain.usageCount, 2);
  // Success rate should have dropped
  assert.ok(usedAgain.successRate < 100);
});

test("validation catches invalid template", () => {
  const errors = validateMissionTemplate({
    basedOnKnowledgeIds: [],
  });
  assert.ok(errors.includes("no_knowledge_ids"));
});

test("registry stores templates", () => {
  clearVoiceMissionTemplateRegistry();

  const { template } = createVoiceMissionTemplate({
    knowledgeRecords: [
      {
        knowledgeId: "k1",
        missionId: "m1",
        extractedPatterns: [],
        domainCoverage: ["domain_1"],
        reusabilityScore: 80,
        createdAt: Date.now(),
        missionType: "stabilize_system",
        missionOutcome: "completed",
        finalHealthScore: 85,
        totalNodes: 2,
        completedNodes: 2,
        failedNodes: 0,
        recoveryTriggered: false,
        replanTriggered: false,
        extractionConfidence: 70,
        evidenceStrength: 60,
      },
    ],
    minPatternConfidence: 50,
    minReusabilityScore: 60,
  });

  registerVoiceMissionTemplate(template);
  const retrieved = getVoiceMissionTemplate(template.templateId);
  assert.ok(retrieved);
  assert.equal(retrieved?.templateId, template.templateId);
});

test("getTemplatesByType filters correctly", () => {
  clearVoiceMissionTemplateRegistry();

  const { template: stabTemplate } = createVoiceMissionTemplate({
    knowledgeRecords: [
      {
        knowledgeId: "k1",
        missionId: "m1",
        extractedPatterns: [],
        domainCoverage: ["domain_1"],
        reusabilityScore: 80,
        createdAt: Date.now(),
        missionType: "stabilize_system",
        missionOutcome: "completed",
        finalHealthScore: 85,
        totalNodes: 2,
        completedNodes: 2,
        failedNodes: 0,
        recoveryTriggered: false,
        replanTriggered: false,
        extractionConfidence: 70,
        evidenceStrength: 60,
      },
    ],
    minPatternConfidence: 50,
    minReusabilityScore: 60,
  });

  registerVoiceMissionTemplate(stabTemplate);
  const stabTemplates = getTemplatesByType("stabilization_flow");
  assert.ok(stabTemplates.length > 0);
});

test("formatVoiceMissionTemplate produces output", () => {
  const { template } = createVoiceMissionTemplate({
    knowledgeRecords: [
      {
        knowledgeId: "k1",
        missionId: "m1",
        extractedPatterns: [],
        domainCoverage: ["domain_1"],
        reusabilityScore: 80,
        createdAt: Date.now(),
        missionType: "stabilize_system",
        missionOutcome: "completed",
        finalHealthScore: 85,
        totalNodes: 2,
        completedNodes: 2,
        failedNodes: 0,
        recoveryTriggered: false,
        replanTriggered: false,
        extractionConfidence: 70,
        evidenceStrength: 60,
      },
    ],
    minPatternConfidence: 50,
    minReusabilityScore: 60,
  });

  const formatted = formatVoiceMissionTemplate(template);
  assert.ok(formatted.includes("Voice Mission Template"));
});

// ============================================================================
// V8.7 — Voice Knowledge Feedback Loop
// ============================================================================
console.log("\n🔁 V8.7 — Voice Knowledge Feedback Loop");

import {
  createVoiceKnowledgeFeedbackLoop,
  evaluateVoiceKnowledgeFeedbackLoop,
  enforceTemplateRecommendations,
  validateFeedbackLoop,
  formatVoiceKnowledgeFeedbackLoop,
  registerVoiceKnowledgeFeedbackLoop,
  getVoiceKnowledgeFeedbackLoop,
  getActiveFeedbackLoops,
  clearVoiceKnowledgeFeedbackLoopRegistry,
} from "../../../src/telegram/voiceKnowledgeFeedbackLoop.js";

test("creates feedback loop from template usage", () => {
  clearVoiceMissionTemplateRegistry();
  clearVoiceKnowledgeFeedbackLoopRegistry();

  const { template } = createVoiceMissionTemplate({
    knowledgeRecords: [
      {
        knowledgeId: "k1",
        missionId: "m1",
        extractedPatterns: [],
        domainCoverage: ["domain_1"],
        reusabilityScore: 80,
        createdAt: Date.now(),
        missionType: "stabilize_system",
        missionOutcome: "completed",
        finalHealthScore: 85,
        totalNodes: 2,
        completedNodes: 2,
        failedNodes: 0,
        recoveryTriggered: false,
        replanTriggered: false,
        extractionConfidence: 70,
        evidenceStrength: 60,
      },
    ],
    minPatternConfidence: 50,
    minReusabilityScore: 60,
  });

  registerVoiceMissionTemplate(template);

  const { loop } = createVoiceKnowledgeFeedbackLoop({
    templates: [template],
    baselineSuccessRate: 60,
    missionOutcomes: [
      { missionId: "m1", templateId: template.templateId, success: true, healthScore: 80 },
      { missionId: "m2", templateId: template.templateId, success: true, healthScore: 85 },
      { missionId: "m3", templateId: template.templateId, success: false, healthScore: 40 },
    ],
  });

  assert.ok(loop.loopId.startsWith("voice_feedback_"));
  assert.equal(loop.appliedTemplates.length, 1);
  assert.equal(loop.affectedMissions.length, 3);
  assert.ok(loop.performanceImpact.successRateChange !== 0);
});

test("feedback loop status transitions correctly", () => {
  clearVoiceMissionTemplateRegistry();

  const { template } = createVoiceMissionTemplate({
    knowledgeRecords: [
      {
        knowledgeId: "k1",
        missionId: "m1",
        extractedPatterns: [],
        domainCoverage: ["domain_1"],
        reusabilityScore: 80,
        createdAt: Date.now(),
        missionType: "stabilize_system",
        missionOutcome: "completed",
        finalHealthScore: 85,
        totalNodes: 2,
        completedNodes: 2,
        failedNodes: 0,
        recoveryTriggered: false,
        replanTriggered: false,
        extractionConfidence: 70,
        evidenceStrength: 60,
      },
    ],
    minPatternConfidence: 50,
    minReusabilityScore: 60,
  });

  // Learning: < 3 missions
  const { loop: learningLoop } = createVoiceKnowledgeFeedbackLoop({
    templates: [template],
    baselineSuccessRate: 60,
    missionOutcomes: [
      { missionId: "m1", templateId: template.templateId, success: true, healthScore: 80 },
    ],
  });
  assert.equal(learningLoop.loopStatus, "learning");

  // Active: 3+ missions but not clearly improving
  const { loop: activeLoop } = createVoiceKnowledgeFeedbackLoop({
    templates: [template],
    baselineSuccessRate: 60,
    missionOutcomes: [
      { missionId: "m1", templateId: template.templateId, success: true, healthScore: 80 },
      { missionId: "m2", templateId: template.templateId, success: false, healthScore: 40 },
      { missionId: "m3", templateId: template.templateId, success: true, healthScore: 70 },
    ],
  });
  assert.ok(activeLoop.loopStatus === "active" || activeLoop.loopStatus === "optimizing");
});

test("evaluateVoiceKnowledgeFeedbackLoop updates metrics", () => {
  clearVoiceMissionTemplateRegistry();

  const { template } = createVoiceMissionTemplate({
    knowledgeRecords: [
      {
        knowledgeId: "k1",
        missionId: "m1",
        extractedPatterns: [],
        domainCoverage: ["domain_1"],
        reusabilityScore: 80,
        createdAt: Date.now(),
        missionType: "stabilize_system",
        missionOutcome: "completed",
        finalHealthScore: 85,
        totalNodes: 2,
        completedNodes: 2,
        failedNodes: 0,
        recoveryTriggered: false,
        replanTriggered: false,
        extractionConfidence: 70,
        evidenceStrength: 60,
      },
    ],
    minPatternConfidence: 50,
    minReusabilityScore: 60,
  });

  const { loop } = createVoiceKnowledgeFeedbackLoop({
    templates: [template],
    baselineSuccessRate: 60,
    missionOutcomes: [
      { missionId: "m1", templateId: template.templateId, success: true, healthScore: 80 },
    ],
  });

  const updated = evaluateVoiceKnowledgeFeedbackLoop(loop, [
    { missionId: "m2", templateId: template.templateId, success: true, healthScore: 85 },
  ]);

  assert.equal(updated.evaluationCount, 2);
  assert.ok(updated.affectedMissions.includes("m2"));
});

test("enforceTemplateRecommendations produces actions", () => {
  clearVoiceMissionTemplateRegistry();

  const { template } = createVoiceMissionTemplate({
    knowledgeRecords: [
      {
        knowledgeId: "k1",
        missionId: "m1",
        extractedPatterns: [],
        domainCoverage: ["domain_1"],
        reusabilityScore: 80,
        createdAt: Date.now(),
        missionType: "stabilize_system",
        missionOutcome: "completed",
        finalHealthScore: 85,
        totalNodes: 2,
        completedNodes: 2,
        failedNodes: 0,
        recoveryTriggered: false,
        replanTriggered: false,
        extractionConfidence: 70,
        evidenceStrength: 60,
      },
    ],
    minPatternConfidence: 50,
    minReusabilityScore: 60,
  });

  const { loop } = createVoiceKnowledgeFeedbackLoop({
    templates: [template],
    baselineSuccessRate: 60,
    missionOutcomes: [
      { missionId: "m1", templateId: template.templateId, success: true, healthScore: 85 },
      { missionId: "m2", templateId: template.templateId, success: true, healthScore: 90 },
      { missionId: "m3", templateId: template.templateId, success: true, healthScore: 80 },
    ],
  });

  const actions = enforceTemplateRecommendations(loop, [template]);
  assert.ok(actions.length > 0);
});

test("validation catches invalid feedback loop", () => {
  const errors = validateFeedbackLoop({
    appliedTemplates: [],
    affectedMissions: [],
  });
  assert.ok(errors.includes("no_applied_templates"));
  assert.ok(errors.includes("no_affected_missions"));
});

test("registry stores feedback loops", () => {
  clearVoiceKnowledgeFeedbackLoopRegistry();
  clearVoiceMissionTemplateRegistry();

  const { template } = createVoiceMissionTemplate({
    knowledgeRecords: [
      {
        knowledgeId: "k1",
        missionId: "m1",
        extractedPatterns: [],
        domainCoverage: ["domain_1"],
        reusabilityScore: 80,
        createdAt: Date.now(),
        missionType: "stabilize_system",
        missionOutcome: "completed",
        finalHealthScore: 85,
        totalNodes: 2,
        completedNodes: 2,
        failedNodes: 0,
        recoveryTriggered: false,
        replanTriggered: false,
        extractionConfidence: 70,
        evidenceStrength: 60,
      },
    ],
    minPatternConfidence: 50,
    minReusabilityScore: 60,
  });

  registerVoiceMissionTemplate(template);

  const { loop } = createVoiceKnowledgeFeedbackLoop({
    templates: [template],
    baselineSuccessRate: 60,
    missionOutcomes: [
      { missionId: "m1", templateId: template.templateId, success: true, healthScore: 80 },
    ],
  });

  registerVoiceKnowledgeFeedbackLoop(loop);
  const retrieved = getVoiceKnowledgeFeedbackLoop(loop.loopId);
  assert.ok(retrieved);
  assert.equal(retrieved?.loopId, loop.loopId);
});

test("formatVoiceKnowledgeFeedbackLoop produces output", () => {
  clearVoiceMissionTemplateRegistry();

  const { template } = createVoiceMissionTemplate({
    knowledgeRecords: [
      {
        knowledgeId: "k1",
        missionId: "m1",
        extractedPatterns: [],
        domainCoverage: ["domain_1"],
        reusabilityScore: 80,
        createdAt: Date.now(),
        missionType: "stabilize_system",
        missionOutcome: "completed",
        finalHealthScore: 85,
        totalNodes: 2,
        completedNodes: 2,
        failedNodes: 0,
        recoveryTriggered: false,
        replanTriggered: false,
        extractionConfidence: 70,
        evidenceStrength: 60,
      },
    ],
    minPatternConfidence: 50,
    minReusabilityScore: 60,
  });

  const { loop } = createVoiceKnowledgeFeedbackLoop({
    templates: [template],
    baselineSuccessRate: 60,
    missionOutcomes: [
      { missionId: "m1", templateId: template.templateId, success: true, healthScore: 80 },
    ],
  });

  const formatted = formatVoiceKnowledgeFeedbackLoop(loop);
  assert.ok(formatted.includes("Voice Knowledge Feedback Loop"));
});

// ============================================================================
// Integration — Self-Evolving Intelligence
// ============================================================================
console.log("\n🧠 Integration — Self-Evolving Intelligence");

import {
  executeSelfEvolvingPipeline,
  findTemplatesForMission,
  formatSelfEvolvingIntelligenceResult,
} from "../../../src/telegram/voiceSelfEvolvingIntelligence.js";

test("full self-evolving pipeline executes", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });
  const activated = activateMission(mission);
  const completed = completeMission(activated);

  const { graph } = buildVoiceMissionExecutionGraph({
    mission: completed,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "Observe" },
      { domainId: "domain_1", actionType: "adapt", description: "Adapt", dependsOn: [0] },
    ],
  });

  let g = graph;
  for (let i = 0; i < g.nodes.length; i++) {
    const started = startGraphNode(g, g.nodes[i].nodeId);
    g = completeGraphNode(started, g.nodes[i].nodeId);
  }

  const result = executeSelfEvolvingPipeline(completed, g, undefined, false, false);

  assert.ok(result.knowledge);
  assert.ok(result.knowledge!.extractedPatterns.length > 0);
  assert.ok(result.summary.length > 0);
});

test("findTemplatesForMission returns matches", () => {
  // Create a template first
  const { template } = createVoiceMissionTemplate({
    knowledgeRecords: [
      {
        knowledgeId: "k1",
        missionId: "m1",
        extractedPatterns: [],
        domainCoverage: ["domain_1"],
        reusabilityScore: 80,
        createdAt: Date.now(),
        missionType: "stabilize_system",
        missionOutcome: "completed",
        finalHealthScore: 85,
        totalNodes: 2,
        completedNodes: 2,
        failedNodes: 0,
        recoveryTriggered: false,
        replanTriggered: false,
        extractionConfidence: 70,
        evidenceStrength: 60,
      },
    ],
    minPatternConfidence: 50,
    minReusabilityScore: 60,
  });
  registerVoiceMissionTemplate(template);

  const matches = findTemplatesForMission("stabilize_system", ["domain_1"], "low");
  assert.ok(matches.length >= 1);
});

test("formatSelfEvolvingIntelligenceResult produces output", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });
  const activated = activateMission(mission);
  const completed = completeMission(activated);

  const { graph } = buildVoiceMissionExecutionGraph({
    mission: completed,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "Observe" },
    ],
  });

  const result = executeSelfEvolvingPipeline(completed, graph, undefined, false, false);
  const formatted = formatSelfEvolvingIntelligenceResult(result);
  assert.ok(formatted.includes("Self-Evolving Mission Intelligence"));
});

// ============================================================================
// Summary
// ============================================================================
console.log(`\n${"═".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(50)}`);

process.exit(failed > 0 ? 1 : 0);
