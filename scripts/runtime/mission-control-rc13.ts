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
  type LongHorizonMemoryKind,
  type StrategicAnchorKind,
} from "../../src/runtime/mission-control/cognitive-memory.js";

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

if (args.memory) {
  result = await recordLongHorizonMemory({
    kind: String(args.kind || "strategic_shift") as LongHorizonMemoryKind,
    trace_id: String(args.trace || `rc13_cli_${Date.now()}`),
    title: String(args.memory),
    summary: String(args.summary || "CLI long-horizon memory entry"),
    impact: String(args.impact || "medium") as any,
    lessons: String(args.lessons || "record durable operational memory").split(",").map((item) => item.trim()).filter(Boolean),
  });
} else if (args.compress) {
  result = await compressRuntimeExperience(args.limit ? Number(args.limit) : undefined);
} else if (args.patterns) {
  result = await recognizeCognitivePatterns(args.limit ? Number(args.limit) : undefined);
} else if (args.anchor) {
  result = await createStrategicMemoryAnchor({
    kind: String(args.kind || "recovery_milestone") as StrategicAnchorKind,
    trace_id: String(args.trace || `rc13_anchor_${Date.now()}`),
    title: String(args.anchor),
    reason: String(args.reason || "CLI strategic memory anchor"),
  });
} else if (args.forecast) {
  result = await generateLongTermStabilityForecast();
} else if (args.narrative) {
  result = await generateRuntimeCognitiveNarrative(args.trace ? String(args.trace) : undefined);
} else if (args.coordinate) {
  result = await generateExperienceAwareCoordination();
} else if (args.dashboard) {
  result = await createCognitiveMemoryDashboard();
} else if (args.smoke) {
  result = await runLongHorizonSmokePack();
} else if (args.freeze) {
  result = await createRuntimeCognitiveMemoryFreeze();
} else {
  result = {
    usage: [
      "npm run mission:control:rc13 -- --memory title --kind incident --summary text",
      "npm run mission:control:rc13 -- --compress",
      "npm run mission:control:rc13 -- --patterns",
      "npm run mission:control:rc13 -- --anchor title --kind critical_incident",
      "npm run mission:control:rc13 -- --forecast",
      "npm run mission:control:rc13 -- --narrative",
      "npm run mission:control:rc13 -- --coordinate",
      "npm run mission:control:rc13 -- --dashboard",
      "npm run mission:control:rc13 -- --smoke",
      "npm run mission:control:rc13 -- --freeze",
    ],
  };
}

console.log(JSON.stringify({ ok: true, result }, null, 2));
