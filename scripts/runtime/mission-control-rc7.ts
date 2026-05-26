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
} from "../../src/runtime/mission-control/intelligence-operations.js";

function parseArgs(): Record<string, boolean | string> {
  const args: Record<string, boolean | string> = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

const args = parseArgs();
let result: unknown;

if (args.predict) {
  result = await generatePredictiveIncidentForecast();
} else if (args.adapt) {
  result = await applyAdaptiveStabilityRegulation();
} else if (args.profile) {
  result = await profileRuntimeBehavior();
} else if (args["federation-risk"]) {
  result = await forecastFederationRisk();
} else if (args.recommend) {
  result = await generateAutonomousOperationalRecommendations();
} else if (args.learn) {
  result = await recordRuntimeLearningLedgerEntry({
    category: String(args.category || "incident_pattern") as any,
    trace_id: String(args.trace || "") || undefined,
    summary: String(args.learn),
    evidence: String(args.evidence || "").split(",").filter(Boolean),
  });
} else if (args.tune) {
  result = await tuneAdaptiveCoordinationPolicy();
} else if (args.dashboard) {
  result = await createRuntimeIntelligenceDashboard();
} else if (args.freeze) {
  result = await createRuntimeIntelligenceOperationsFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc7 -- --predict",
      "npm run mission:control:rc7 -- --adapt",
      "npm run mission:control:rc7 -- --profile",
      "npm run mission:control:rc7 -- --federation-risk",
      "npm run mission:control:rc7 -- --recommend",
      "npm run mission:control:rc7 -- --learn 'lesson' --category successful_recovery --trace trace_id",
      "npm run mission:control:rc7 -- --tune",
      "npm run mission:control:rc7 -- --dashboard",
      "npm run mission:control:rc7 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
