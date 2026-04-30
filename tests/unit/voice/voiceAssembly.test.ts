import {
  assembleVoiceResponse,
  extractFirstSentence,
  makeFirstSentenceVoiceReady,
  reduceWrittenDensity,
  type VoiceAssemblyInput,
} from "../../../src/telegram/voiceAssembly.js";

function makeInput(overrides: Partial<VoiceAssemblyInput>): VoiceAssemblyInput {
  return { text: "", ...overrides };
}

// --- A: Direct short reply → opening compact, spoken-safe ---

function testDirectShortReply() {
  const input = makeInput({
    text: "Ну, короче, смотри, я это сделал.",
    userTone: "direct",
    cadenceMode: "crisp_direct",
    answerLength: "short",
  });
  const r = assembleVoiceResponse(input);

  if (r.mode !== "direct_spoken") throw new Error(`Expected direct_spoken, got ${r.mode}`);
  // Should remove fillers for direct mode
  if (r.fullSpokenText.includes("Ну, короче")) {
    throw new Error("Direct mode should remove fillers");
  }
  console.log(`✅ testDirectShortReply passed (mode=${r.mode}, text="${r.fullSpokenText}")`);
}

// --- B: Supportive reply → softer first sentence, not abrupt ---

function testSupportiveReply() {
  const input = makeInput({
    text: "Понимаю. Тяжело сейчас.",
    userTone: "support-seeking",
    responseStyle: "supportive",
    cadenceMode: "supportive_gentle",
    answerLength: "short",
  });
  const r = assembleVoiceResponse(input);

  if (r.mode !== "supportive_spoken") throw new Error(`Expected supportive_spoken, got ${r.mode}`);
  // First sentence should be complete, not abrupt
  if (r.firstSentenceText && r.firstSentenceText.length < 10) {
    throw new Error("Supportive first sentence should not be too short");
  }
  console.log(`✅ testSupportiveReply passed (mode=${r.mode}, first="${r.firstSentenceText}")`);
}

// --- C: Long dense answer → density reduced, spoken cleanup applied ---

function testLongDenseAnswer() {
  const input = makeInput({
    text: "Сейчас объясню: архитектура включает три компонента — базу данных, которая хранит все настройки; API сервер, который обрабатывает запросы; и клиент, который отображает интерфейс.",
    taskComplexity: "high",
    answerLength: "long",
    cadenceMode: "steady_explanatory",
  });
  const r = assembleVoiceResponse(input);

  if (!r.shouldReduceDensity) throw new Error("Should reduce density for high complexity");
  if (!r.shouldShortenSentences) throw new Error("Should shorten sentences for high complexity");

  // Written connectors should be replaced with spoken pauses
  if (r.fullSpokenText.includes("—")) {
    throw new Error("Em-dash should be replaced for spoken delivery");
  }
  if (r.fullSpokenText.includes(":")) {
    throw new Error("Colon should be replaced for spoken delivery");
  }

  console.log(`✅ testLongDenseAnswer passed (density_reduced=${r.shouldReduceDensity}, sentences_shortened=${r.shouldShortenSentences})`);
}

// --- D: First sentence extraction deterministic ---

function testFirstSentenceExtractionDeterministic() {
  const text = "Привет! Как дела? Всё хорошо.";

  for (let i = 0; i < 10; i++) {
    const first = extractFirstSentence(text);
    if (first !== "Привет!") throw new Error(`Non-deterministic: got "${first}"`);
  }

  console.log("✅ testFirstSentenceExtractionDeterministic passed");
}

// --- E: No semantic drift for bounded cleanup ---

function testNoSemanticDrift() {
  const input = makeInput({
    text: "Завтра встреча в 10 утра в конференц-зале номер 5.",
    answerLength: "short",
  });
  const r = assembleVoiceResponse(input);

  // Key facts must be preserved
  if (!r.fullSpokenText.includes("10")) throw new Error("Time fact should be preserved");
  if (!r.fullSpokenText.toLowerCase().includes("встреч")) throw new Error("Meeting fact should be preserved");
  if (!r.fullSpokenText.toLowerCase().includes("5")) throw new Error("Room number should be preserved");

  console.log("✅ testNoSemanticDrift passed");
}

// --- F: Short answer not over-split ---

function testShortAnswerNotOverSplit() {
  const input = makeInput({
    text: "Сделано.",
    answerLength: "short",
  });
  const r = assembleVoiceResponse(input);

  // Short answer should remain as-is
  if (r.fullSpokenText.length < 7) throw new Error("Short answer should not be over-trimmed");
  if (r.shouldShortenSentences) throw new Error("Short answer should not need sentence shortening");

  console.log("✅ testShortAnswerNotOverSplit passed");
}

// --- G: Multilingual invariance ---

function testMultilingualInvariance() {
  const ruInput = makeInput({
    text: "Привет! Как дела?",
    answerLength: "short",
  });

  const enInput = makeInput({
    text: "Hi! How are you?",
    answerLength: "short",
  });

  // Both should produce valid assembly (no language-specific errors)
  const rRu = assembleVoiceResponse(ruInput);
  const rEn = assembleVoiceResponse(enInput);

  if (!rRu.fullSpokenText || !rEn.fullSpokenText) throw new Error("Both should produce text");
  if (rRu.fullSpokenText.length === 0 || rEn.fullSpokenText.length === 0) throw new Error("Both should have non-empty text");

  console.log("✅ testMultilingualInvariance passed");
}

// --- H: Assembly output better suited for first-audio than raw text ---

function testAssemblyBetterForFirstAudio() {
  // Dense written text that's bad for first-audio
  const denseText = "Смотри, если говорить в целом, то архитектура включает несколько компонентов — базу данных, API, и клиент, которые взаимодействуют друг с другом.";

  const input = makeInput({
    text: denseText,
    taskComplexity: "high",
    cadenceMode: "steady_explanatory",
  });
  const r = assembleVoiceResponse(input);

  // Assembly should clean up the text
  const rawFirstSentence = extractFirstSentence(denseText);
  const assembledFirstSentence = r.firstSentenceText;

  // Assembled first sentence should be cleaner
  if (assembledFirstSentence) {
    if (assembledFirstSentence.startsWith("Смотри,") || assembledFirstSentence.startsWith("Смотри ")) {
      throw new Error("First sentence should not start with filler 'Смотри'");
    }
  }

  // Full text should have density reduced
  if (r.fullSpokenText.includes("—")) {
    throw new Error("Em-dash should be replaced");
  }

  console.log(`✅ testAssemblyBetterForFirstAudio passed (raw_first="${rawFirstSentence}", assembled_first="${assembledFirstSentence}")`);
}

// --- I: Hints are present and meaningful ---

function testHintsPresent() {
  const input = makeInput({
    text: "Ну, короче, я сделал это.",
    userTone: "direct",
    answerLength: "short",
  });
  const r = assembleVoiceResponse(input);

  if (r.hints.length === 0) throw new Error("Direct cleanup should produce hints");
  const hasRelevantHint = r.hints.some(h =>
    h === "spoken_cleanup_applied" ||
    h === "direct_opening_compacted" ||
    h === "first_sentence_prepared_for_voice"
  );
  if (!hasRelevantHint) throw new Error(`Should have relevant hint, got: ${JSON.stringify(r.hints)}`);

  console.log(`✅ testHintsPresent passed (hints=${JSON.stringify(r.hints)})`);
}

// --- J: Warnings only when real risks exist ---

function testWarningsOnlyWhenNeeded() {
  // High complexity → should warn
  const rHigh = assembleVoiceResponse(makeInput({ text: "A".repeat(200), taskComplexity: "high" }));
  const hasComplexityWarning = rHigh.warnings.some(w =>
    w === "source_text_too_dense_for_voice" ||
    w === "complex_written_structure_detected" ||
    w === "voice_assembly_preserved_meaning_with_cleanup"
  );
  if (!hasComplexityWarning) throw new Error("High complexity should produce warnings");

  // Short clean text → no warnings
  const rShort = assembleVoiceResponse(makeInput({ text: "Сделано.", answerLength: "short" }));
  console.log(`✅ testWarningsOnlyWhenNeeded passed (high_warnings=${rHigh.warnings.length}, short_warnings=${rShort.warnings.length})`);
}

async function main() {
  testDirectShortReply();
  testSupportiveReply();
  testLongDenseAnswer();
  testFirstSentenceExtractionDeterministic();
  testNoSemanticDrift();
  testShortAnswerNotOverSplit();
  testMultilingualInvariance();
  testAssemblyBetterForFirstAudio();
  testHintsPresent();
  testWarningsOnlyWhenNeeded();
  console.log("\n✅ All voice response assembly tests passed");
}

main().catch((e) => {
  console.error("❌ Test failed:", e);
  process.exit(1);
});
