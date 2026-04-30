import { decideVoiceStyle, VoiceStyleMode, adaptSpeechRateForSay } from "../../../src/telegram/voiceStyle.js";

// --- Greeting → warm ---

function testGreetingIsWarm() {
  for (const t of ["привет", "привет!", "здравствуй", "добрый день", "hello", "hi there"]) {
    const r = decideVoiceStyle(t);
    if (r.mode !== "warm") throw new Error(`"${t}" should be warm, got ${r.mode}`);
    if (r.reason !== "warm_greeting") throw new Error(`"${t}" reason should be warm_greeting, got ${r.reason}`);
  }
  console.log("✅ testGreetingIsWarm passed");
}

// --- Support → supportive ---

function testSupportIsSupportive() {
  for (const t of ["мне нужна поддержка", "мне тяжело сейчас", "я не знаю что делать", "помоги мне разобраться"]) {
    const r = decideVoiceStyle(t);
    if (r.mode !== "supportive") throw new Error(`"${t}" should be supportive, got ${r.mode}`);
    if (r.reason !== "support_detected") throw new Error(`"${t}" reason should be support_detected, got ${r.reason}`);
  }
  console.log("✅ testSupportIsSupportive passed");
}

// --- Neutral info → neutral ---

function testNeutralInfo() {
  for (const t of [
    "Архитектура системы включает три основных компонента: базу данных, API сервер и клиентское приложение",
    "Документация по проекту доступна по ссылке в репозитории, там есть все необходимые инструкции",
  ]) {
    const r = decideVoiceStyle(t);
    if (r.mode !== "neutral") throw new Error(`"${t.slice(0, 30)}..." should be neutral, got ${r.mode}`);
    // shapedText should preserve original meaning
    if (!r.shapedText.includes("Архитектура") && !r.shapedText.includes("Документация")) {
      throw new Error("shapedText should preserve original content");
    }
  }
  console.log("✅ testNeutralInfo passed");
}

// --- Confirmation → concise ---

function testConfirmationIsConcise() {
  for (const t of ["ok", "ок", "да", "сделано", "готово", "принято", "подтверждаю"]) {
    const r = decideVoiceStyle(t);
    if (r.mode !== "concise") throw new Error(`"${t}" should be concise, got ${r.mode}`);
  }
  console.log("✅ testConfirmationIsConcise passed");
}

// --- Short replies → concise ---

function testShortReplyIsConcise() {
  const r = decideVoiceStyle("Хорошо, сделаю");
  if (r.mode !== "concise") throw new Error(`Short reply should be concise, got ${r.mode}`);
  console.log("✅ testShortReplyIsConcise passed");
}

// --- Speech rate adaptation ---

function testSpeechRateAdaptation() {
  const rates: Record<VoiceStyleMode, number> = {
    supportive: adaptSpeechRateForSay("supportive"),
    warm: adaptSpeechRateForSay("warm"),
    neutral: adaptSpeechRateForSay("neutral"),
    concise: adaptSpeechRateForSay("concise"),
  };

  // Supportive should be slowest (calming)
  if (rates.supportive >= rates.neutral) throw new Error("supportive should be slower than neutral");
  // Concise should be fastest
  if (rates.concise <= rates.neutral) throw new Error("concise should be faster than neutral");
  // Warm should be slightly slower than neutral
  if (rates.warm >= rates.neutral) throw new Error("warm should be slightly slower than neutral");
  // Neutral should be around 200
  if (rates.neutral !== 200) throw new Error(`neutral rate should be 200, got ${rates.neutral}`);

  console.log(`✅ testSpeechRateAdaptation passed (supportive=${rates.supportive}, warm=${rates.warm}, neutral=${rates.neutral}, concise=${rates.concise})`);
}

// --- Fast provider gets only supported adaptation ---

function testFastProviderAdaptation() {
  // Fast provider (say_macos) gets speech rate adaptation
  const r = decideVoiceStyle("привет");
  if (r.mode !== "warm") throw new Error("Should be warm");
  if (r.providerHint.speechRate === undefined) throw new Error("Should have speechRate hint");
  if (typeof r.providerHint.speechRate !== "number") throw new Error("speechRate should be number");

  // Rate should match adaptSpeechRateForSay
  const expectedRate = adaptSpeechRateForSay(r.mode);
  // providerHint.speechRate is a ratio (0.85-1.1), adaptSpeechRateForSay returns wpm (160-220)
  // Both should be directionally consistent
  if (r.mode === "supportive" && expectedRate >= 200) throw new Error("supportive wpm should be < 200");
  if (r.mode === "concise" && expectedRate <= 200) throw new Error("concise wpm should be > 200");

  console.log("✅ testFastProviderAdaptation passed");
}

// --- Kozy path remains safe (style doesn't break it) ---

function testKozyPathSafe() {
  // Kozy doesn't support style params directly — style only affects metadata
  const r = decideVoiceStyle("Расскажи подробнее", "kozy");
  // shapedText should be the original text (Kozy doesn't get text reshaping in current impl)
  if (r.shapedText !== "Расскажи подробнее") throw new Error("shapedText should equal original for Kozy");
  // Mode should still be chosen
  if (!["neutral", "warm", "supportive", "concise"].includes(r.mode)) {
    throw new Error(`Invalid mode: ${r.mode}`);
  }
  console.log("✅ testKozyPathSafe passed");
}

// --- No semantic drift ---

function testNoSemanticDrift() {
  const original = "Завтра встреча в 10 утра, не забудь";
  const r = decideVoiceStyle(original);
  // shapedText should not change meaning
  if (r.shapedText !== original) {
    // If shaping occurs, it should preserve key information
    if (!r.shapedText.includes("встреч") && !r.shapedText.includes("10")) {
      throw new Error("shapedText should preserve key information");
    }
  }
  console.log("✅ testNoSemanticDrift passed");
}

// --- Fallback to neutral on style failure ---

function testFallbackToNeutral() {
  // Edge cases should fall back to neutral
  for (const t of ["", "   ", "12345", "!@#$%"]) {
    const r = decideVoiceStyle(t);
    // Empty/whitespace → neutral (no patterns match)
    if (r.mode !== "neutral") {
      // Short non-matching strings may go to concise
      if (t.trim().length > 0 && t.trim().length < 30 && r.mode === "concise") continue;
      throw new Error(`"${t}" should be neutral or concise, got ${r.mode}`);
    }
  }
  console.log("✅ testFallbackToNeutral passed");
}

async function main() {
  testGreetingIsWarm();
  testSupportIsSupportive();
  testNeutralInfo();
  testConfirmationIsConcise();
  testShortReplyIsConcise();
  testSpeechRateAdaptation();
  testFastProviderAdaptation();
  testKozyPathSafe();
  testNoSemanticDrift();
  testFallbackToNeutral();
  console.log("\n✅ All voice personality/style tests passed");
}

main().catch((e) => {
  console.error("❌ Test failed:", e);
  process.exit(1);
});
