import {
  smoothVoiceTurn,
  trimAbruptTurnEdges,
  type VoiceTurnSmoothingInput,
} from "../../../src/telegram/voiceTurnSmoothing.js";

function makeInput(overrides: Partial<VoiceTurnSmoothingInput>): VoiceTurnSmoothingInput {
  return { text: "", ...overrides };
}

// --- A: Direct concise reply → compact clean entry ---

function testDirectConciseCleanEntry() {
  const input = makeInput({
    text: "Так. Я это сделал.",
    responseStyle: "concise",
    cadenceMode: "crisp_direct",
    answerLength: "short",
  });
  const r = smoothVoiceTurn(input);

  if (r.entryMode !== "clean_direct_entry") throw new Error(`Expected clean_direct_entry, got ${r.entryMode}`);
  if (!r.shouldCompactEntry) throw new Error("Should compact entry for direct mode");
  if (r.exitMode !== "clean_stop") throw new Error(`Expected clean_stop, got ${r.exitMode}`);
  if (!r.shouldKeepEndingClean) throw new Error("Should keep ending clean for short answer");
  // "Так." should be removed as abrupt opener
  if (r.smoothedText.startsWith("Так")) throw new Error(`Abrupt opener "Так" should be removed, got: "${r.smoothedText}"`);
  console.log(`✅ testDirectConciseCleanEntry passed (entry=${r.entryMode}, exit=${r.exitMode}, text="${r.smoothedText}")`);
}

// --- B: Continuing follow-up → softer reentry ---

function testContinuingFollowupSofterReentry() {
  const input = makeInput({
    text: "Ну, продолжая тему, вот детали.",
    presenceMode: "continuing",
    responseStyle: "warm",
    cadenceMode: "warm_compact",
    isFollowUp: true,
    answerLength: "medium",
  });
  const r = smoothVoiceTurn(input);

  if (r.entryMode !== "warm_reentry_entry" && r.entryMode !== "soft_continuation_entry") {
    throw new Error(`Expected continuation entry, got ${r.entryMode}`);
  }
  if (!r.shouldSoftenEntry) throw new Error("Should soften entry for follow-up");
  if (r.exitMode !== "warm_hold" && r.exitMode !== "soft_landing") {
    throw new Error(`Expected warm_hold or soft_landing, got ${r.exitMode}`);
  }
  console.log(`✅ testContinuingFollowupSofterReentry passed (entry=${r.entryMode}, exit=${r.exitMode})`);
}

// --- C: Supportive reply → gentle entry + non-harsh ending ---

function testSupportiveGentleEntryExit() {
  const input = makeInput({
    text: "Смотри, я понимаю что тяжело. Мы справимся.",
    responseStyle: "supportive",
    cadenceMode: "supportive_gentle",
    answerLength: "medium",
  });
  const r = smoothVoiceTurn(input);

  if (r.entryMode !== "supportive_gentle_entry") throw new Error(`Expected supportive_gentle_entry, got ${r.entryMode}`);
  if (r.exitMode !== "supportive_hold") throw new Error(`Expected supportive_hold, got ${r.exitMode}`);
  if (!r.shouldSoftenEntry) throw new Error("Should soften entry for supportive");
  if (!r.shouldSoftenEnding) throw new Error("Should soften ending for supportive");
  // "Смотри," should be removed
  if (r.smoothedText.startsWith("Смотри")) throw new Error(`"Смотри" should be removed, got: "${r.smoothedText}"`);
  console.log(`✅ testSupportiveGentleEntryExit passed (entry=${r.entryMode}, exit=${r.exitMode}, text="${r.smoothedText}")`);
}

// --- D: Short practical reply → clean stop ---

function testShortPracticalCleanStop() {
  const input = makeInput({
    text: "Сделано.",
    responseStyle: "neutral",
    cadenceMode: "crisp_direct",
    answerLength: "short",
  });
  const r = smoothVoiceTurn(input);

  if (r.entryMode !== "clean_direct_entry") throw new Error(`Expected clean_direct_entry, got ${r.entryMode}`);
  if (r.exitMode !== "clean_stop") throw new Error(`Expected clean_stop, got ${r.exitMode}`);
  if (r.shouldSoftenEnding) throw new Error("Should not soften ending for short answer");
  if (!r.shouldKeepEndingClean) throw new Error("Should keep ending clean for short answer");
  console.log(`✅ testShortPracticalCleanStop passed (entry=${r.entryMode}, exit=${r.exitMode})`);
}

// --- E: Long guided reply → softer landing ---

function testLongGuidedSofterLanding() {
  const input = makeInput({
    text: "Объясняю. Архитектура включает три компонента — базу, сервер и клиент. Они работают вместе. И всё.",
    cadenceMode: "soft_guided",
    answerLength: "long",
    taskComplexity: "high",
  });
  const r = smoothVoiceTurn(input);

  if (r.exitMode !== "soft_landing") throw new Error(`Expected soft_landing, got ${r.exitMode}`);
  if (!r.shouldSoftenEnding) throw new Error("Should soften ending for long guided");
  // "И всё." should be cleaned up
  if (r.smoothedText.includes("И всё")) throw new Error(`"И всё" should be cleaned, got: "${r.smoothedText}"`);
  console.log(`✅ testLongGuidedSofterLanding passed (exit=${r.exitMode}, text="${r.smoothedText}")`);
}

// --- F: No semantic drift ---

function testNoSemanticDrift() {
  const input = makeInput({
    text: "Завтра встреча в 10 утра в конференц-зале номер 5.",
    answerLength: "medium",
    responseStyle: "neutral",
  });
  const r = smoothVoiceTurn(input);

  // Key facts must be preserved
  if (!r.smoothedText.includes("10")) throw new Error("Time fact should be preserved");
  if (!r.smoothedText.toLowerCase().includes("встреч")) throw new Error("Meeting fact should be preserved");
  if (!r.smoothedText.includes("5")) throw new Error("Room number should be preserved");
  console.log("✅ testNoSemanticDrift passed");
}

// --- G: Multilingual invariance ---

function testMultilingualInvariance() {
  const ruInput = makeInput({
    text: "Так. Сделано.",
    responseStyle: "concise",
    answerLength: "short",
  });

  const enInput = makeInput({
    text: "So. Done.",
    responseStyle: "concise",
    answerLength: "short",
  });

  // Both should produce valid smoothing (no language-specific errors)
  const rRu = smoothVoiceTurn(ruInput);
  const rEn = smoothVoiceTurn(enInput);

  if (!rRu.smoothedText || !rEn.smoothedText) throw new Error("Both should produce text");
  if (rRu.smoothedText.length === 0 || rEn.smoothedText.length === 0) throw new Error("Both should have non-empty text");

  console.log("✅ testMultilingualInvariance passed");
}

// --- H: Smoothed output more voice-safe than raw in abrupt edge case ---

function testSmoothedMoreVoiceSafeThanRaw() {
  const rawText = "Ну. Смотри, если говорить в целом... и всё.";
  const input = makeInput({
    text: rawText,
    presenceMode: "continuing",
    responseStyle: "warm",
    cadenceMode: "warm_compact",
    answerLength: "medium",
    isFollowUp: true,
  });
  const r = smoothVoiceTurn(input);

  // Smoothed text should be cleaner than raw
  if (r.smoothedText.includes("Ну.") || r.smoothedText.startsWith("Ну ")) {
    throw new Error(`"Ну." should be cleaned, got: "${r.smoothedText}"`);
  }
  if (r.smoothedText.includes("Смотри,")) {
    throw new Error(`"Смотри," should be cleaned, got: "${r.smoothedText}"`);
  }
  // Middle ellipsis is OK — only trailing "..." should be cleaned
  if (r.smoothedText.endsWith("...")) {
    throw new Error(`Trailing "..." should be cleaned, got: "${r.smoothedText}"`);
  }
  if (r.smoothedText.includes("и всё.")) {
    throw new Error(`"и всё." should be cleaned, got: "${r.smoothedText}"`);
  }

  console.log(`✅ testSmoothedMoreVoiceSafeThanRaw passed (raw="${rawText}", smoothed="${r.smoothedText}")`);
}

// --- I: trimAbruptTurnEdges works deterministically ---

function testTrimAbruptTurnEdgesDeterministic() {
  const texts = [
    "Так. Привет.",
    "Ну, короче. Сделано.",
    "Смотри, вот как это работает...",
    "Ладно, продолжим.",
  ];

  for (const text of texts) {
    const r1 = trimAbruptTurnEdges(text);
    const r2 = trimAbruptTurnEdges(text);
    if (r1 !== r2) throw new Error(`Non-deterministic for "${text}": "${r1}" vs "${r2}"`);
  }

  console.log("✅ testTrimAbruptTurnEdgesDeterministic passed");
}

// --- J: Hints and warnings present when appropriate ---

function testHintsAndWarningsPresent() {
  // Abrupt text should produce warnings
  const abruptInput = makeInput({
    text: "Так. Смотри, это важно...",
    responseStyle: "supportive",
    cadenceMode: "supportive_gentle",
    answerLength: "medium",
  });
  const r = smoothVoiceTurn(abruptInput);

  if (r.warnings.length === 0) throw new Error("Abrupt text should produce warnings");
  if (r.hints.length === 0) throw new Error("Should have hints for smoothing");

  console.log(`✅ testHintsAndWarningsPresent passed (hints=${r.hints.length}, warnings=${r.warnings.length})`);
}

async function main() {
  testDirectConciseCleanEntry();
  testContinuingFollowupSofterReentry();
  testSupportiveGentleEntryExit();
  testShortPracticalCleanStop();
  testLongGuidedSofterLanding();
  testNoSemanticDrift();
  testMultilingualInvariance();
  testSmoothedMoreVoiceSafeThanRaw();
  testTrimAbruptTurnEdgesDeterministic();
  testHintsAndWarningsPresent();
  console.log("\n✅ All voice turn smoothing tests passed");
}

main().catch((e) => {
  console.error("❌ Test failed:", e);
  process.exit(1);
});
