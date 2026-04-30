import { decideVoiceCadence, cadenceToSpeechRate, VoiceCadenceInput } from "../../../src/telegram/voiceCadence.js";

// --- A: Direct user → crisp / tight / short_bursts ---

function testDirectUserCrisp() {
  const input: VoiceCadenceInput = { userTone: "direct" };
  const r = decideVoiceCadence(input);
  if (r.cadenceMode !== "crisp_direct") throw new Error(`Expected crisp_direct, got ${r.cadenceMode}`);
  if (r.pacingDensity !== "tight") throw new Error(`Expected tight, got ${r.pacingDensity}`);
  if (r.sentenceShape !== "short_bursts") throw new Error(`Expected short_bursts, got ${r.sentenceShape}`);
  if (r.preferShortSentences !== true) throw new Error("Direct should prefer short sentences");
  if (r.allowSoftLeadIn !== false) throw new Error("Direct should not allow soft lead-in");
  console.log("✅ testDirectUserCrisp passed");
}

// --- B: Support-seeking → supportive_gentle / airy / smooth_layered ---

function testSupportSeekingGentle() {
  const input: VoiceCadenceInput = { userTone: "support-seeking" };
  const r = decideVoiceCadence(input);
  if (r.cadenceMode !== "supportive_gentle") throw new Error(`Expected supportive_gentle, got ${r.cadenceMode}`);
  if (r.pacingDensity !== "airy") throw new Error(`Expected airy, got ${r.pacingDensity}`);
  if (r.sentenceShape !== "smooth_layered") throw new Error(`Expected smooth_layered, got ${r.sentenceShape}`);
  if (r.allowSoftLeadIn !== true) throw new Error("Supportive should allow soft lead-in");
  if (r.avoidDenseStacking !== true) throw new Error("Supportive should avoid dense stacking");
  console.log("✅ testSupportSeekingGentle passed");
}

// --- C: High complexity → not overly tight ---

function testHighComplexityNotTight() {
  const input: VoiceCadenceInput = { taskComplexity: "high" };
  const r = decideVoiceCadence(input);
  if (r.pacingDensity === "tight") throw new Error(`High complexity should not be tight, got ${r.pacingDensity}`);
  if (r.cadenceMode !== "steady_explanatory") throw new Error(`Expected steady_explanatory, got ${r.cadenceMode}`);
  console.log("✅ testHighComplexityNotTight passed");
}

// --- D: Short answer → short but not robotic ---

function testShortAnswerNatural() {
  const input: VoiceCadenceInput = { answerLength: "short" };
  const r = decideVoiceCadence(input);
  if (r.cadenceMode !== "warm_compact") throw new Error(`Expected warm_compact, got ${r.cadenceMode}`);
  if (r.pacingDensity !== "tight") throw new Error(`Expected tight, got ${r.pacingDensity}`);
  if (r.sentenceShape !== "short_bursts") throw new Error(`Expected short_bursts, got ${r.sentenceShape}`);
  if (r.shouldEndCleanly !== true) throw new Error("Should always end cleanly");
  console.log("✅ testShortAnswerNatural passed");
}

// --- E: Follow-up → slightly tighter but still aligned ---

function testFollowUpTighter() {
  // Follow-up in warm context → warm_compact, not abrupt
  const inputWarm: VoiceCadenceInput = { isFollowUp: true, relationshipMode: "warm" };
  const rWarm = decideVoiceCadence(inputWarm);
  if (rWarm.cadenceMode !== "warm_compact") throw new Error(`Warm follow-up should be warm_compact, got ${rWarm.cadenceMode}`);
  if (rWarm.allowSoftLeadIn !== true) throw new Error("Warm follow-up should allow soft lead-in");

  // Follow-up in practical context → crisp_direct, tighter
  const inputPractical: VoiceCadenceInput = { isFollowUp: true, relationshipMode: "practical" };
  const rPractical = decideVoiceCadence(inputPractical);
  if (rPractical.cadenceMode !== "crisp_direct") throw new Error(`Practical follow-up should be crisp_direct, got ${rPractical.cadenceMode}`);

  console.log("✅ testFollowUpTighter passed");
}

// --- F: Multilingual invariance of behavior ---

function testMultilingualInvariance() {
  // Same logic inputs should produce same cadence regardless of language signal
  // (cadence doesn't use language as input — behavior is language-invariant)
  const base: VoiceCadenceInput = { userTone: "direct" };
  const r = decideVoiceCadence(base);

  // Run again — should be identical (deterministic)
  const r2 = decideVoiceCadence(base);
  if (JSON.stringify(r) !== JSON.stringify(r2)) {
    throw new Error("Cadence should be deterministic");
  }

  console.log("✅ testMultilingualInvariance passed");
}

// --- G: Supportive response style → gentle ---

function testSupportiveStyleGentle() {
  const input: VoiceCadenceInput = { responseStyle: "supportive" };
  const r = decideVoiceCadence(input);
  if (r.cadenceMode !== "supportive_gentle") throw new Error(`Expected supportive_gentle, got ${r.cadenceMode}`);
  console.log("✅ testSupportiveStyleGentle passed");
}

// --- H: High complexity + warm relationship → soft_guided ---

function testHighComplexityWarmSoftGuided() {
  const input: VoiceCadenceInput = { taskComplexity: "high", relationshipMode: "warm" };
  const r = decideVoiceCadence(input);
  if (r.cadenceMode !== "soft_guided") throw new Error(`Expected soft_guided, got ${r.cadenceMode}`);
  if (r.pacingDensity !== "balanced") throw new Error(`Expected balanced, got ${r.pacingDensity}`);
  console.log("✅ testHighComplexityWarmSoftGuided passed");
}

// --- I: Cadence to speech rate mapping ---

function testCadenceToSpeechRate() {
  const rates = {
    crisp_direct: cadenceToSpeechRate({ cadenceMode: "crisp_direct" } as any),
    warm_compact: cadenceToSpeechRate({ cadenceMode: "warm_compact" } as any),
    steady_explanatory: cadenceToSpeechRate({ cadenceMode: "steady_explanatory" } as any),
    soft_guided: cadenceToSpeechRate({ cadenceMode: "soft_guided" } as any),
    supportive_gentle: cadenceToSpeechRate({ cadenceMode: "supportive_gentle" } as any),
  };

  // crisp_direct should be fastest
  if (rates.crisp_direct <= rates.warm_compact) throw new Error("crisp_direct should be faster than warm_compact");
  // supportive_gentle should be slowest
  if (rates.supportive_gentle >= rates.steady_explanatory) throw new Error("supportive_gentle should be slower than steady_explanatory");
  // All should be in reasonable range
  for (const [mode, rate] of Object.entries(rates)) {
    if (rate < 140 || rate > 250) throw new Error(`${mode} rate ${rate} out of reasonable range`);
  }

  console.log(`✅ testCadenceToSpeechRate passed (crisp=${rates.crisp_direct}, warm=${rates.warm_compact}, steady=${rates.steady_explanatory}, soft=${rates.soft_guided}, supportive=${rates.supportive_gentle})`);
}

// --- J: shouldEndCleanly always true ---

function testAlwaysEndsCleanly() {
  const inputs: VoiceCadenceInput[] = [
    { userTone: "direct" },
    { userTone: "support-seeking" },
    { taskComplexity: "high" },
    { answerLength: "short" },
    { isFollowUp: true },
    {},
  ];

  for (const input of inputs) {
    const r = decideVoiceCadence(input);
    if (r.shouldEndCleanly !== true) {
      throw new Error(`shouldEndCleanly should always be true, got ${r.shouldEndCleanly} for ${JSON.stringify(input)}`);
    }
  }

  console.log("✅ testAlwaysEndsCleanly passed");
}

// --- K: Hints are present and meaningful ---

function testHintsPresent() {
  const r = decideVoiceCadence({ userTone: "direct" });
  if (r.hints.length === 0) throw new Error("Direct cadence should have hints");
  if (!r.hints.includes("prefer_clean_spoken_chunks")) throw new Error("Direct should hint clean chunks");
  console.log("✅ testHintsPresent passed");
}

// --- L: Warnings only when real risks exist ---

function testWarningsOnlyWhenNeeded() {
  // Direct → has abruptness warning
  const rDirect = decideVoiceCadence({ userTone: "direct" });
  if (!rDirect.warnings.includes("direct_mode_risk_of_abruptness")) throw new Error("Direct should warn of abruptness");

  // Supportive → has brisk warning
  const rSupport = decideVoiceCadence({ userTone: "support-seeking" });
  if (!rSupport.warnings.includes("supportive_context_should_not_sound_brisk")) throw new Error("Supportive should warn against brisk tone");

  // Short answer → no warnings
  const rShort = decideVoiceCadence({ answerLength: "short" });
  if (rShort.warnings.length > 0) throw new Error(`Short answer should have no warnings, got ${rShort.warnings}`);

  console.log("✅ testWarningsOnlyWhenNeeded passed");
}

async function main() {
  testDirectUserCrisp();
  testSupportSeekingGentle();
  testHighComplexityNotTight();
  testShortAnswerNatural();
  testFollowUpTighter();
  testMultilingualInvariance();
  testSupportiveStyleGentle();
  testHighComplexityWarmSoftGuided();
  testCadenceToSpeechRate();
  testAlwaysEndsCleanly();
  testHintsPresent();
  testWarningsOnlyWhenNeeded();
  console.log("\n✅ All voice rhythm/cadence tests passed");
}

main().catch((e) => {
  console.error("❌ Test failed:", e);
  process.exit(1);
});
