import { decideVoiceStrategy, VoiceStrategyConfig } from "../../../src/telegram/voiceStrategy.js";

function cfg(overrides: Partial<VoiceStrategyConfig> = {}): Partial<VoiceStrategyConfig> {
  return { kozyLive: true, fastProviderLive: false, ...overrides };
}

// --- Acknowledgements → text_only ---

function testUltraShortAcks() {
  for (const t of ["ok", "ок", "да", "нет", "ага", "угу", "ладно", "ясно", "понял", "спасибо"]) {
    const r = decideVoiceStrategy(t, cfg());
    if (r.mode !== "text_only") throw new Error(`"${t}" should be text_only, got ${r.mode}`);
    if (r.voice_allowed !== false) throw new Error(`"${t}" should not allow voice`);
  }
  console.log("✅ testUltraShortAcks passed");
}

function testGreetings() {
  for (const t of ["привет", "привет!", "да", "да.", "hello", "hi", "пока"]) {
    const r = decideVoiceStrategy(t, cfg());
    if (r.mode !== "text_only") throw new Error(`"${t}" should be text_only, got ${r.mode}`);
  }
  console.log("✅ testGreetings passed");
}

// --- Short friendly replies → voice_quality ---

function testShortFriendlyReply() {
  const r = decideVoiceStrategy("Расскажи подробнее об этом проекте", cfg());
  if (r.mode !== "voice_quality") throw new Error(`Should be voice_quality, got ${r.mode}`);
  if (r.voice_allowed !== true) throw new Error("voice_allowed should be true");
  if (r.preferred_provider !== "kozy") throw new Error(`provider should be kozy, got ${r.preferred_provider}`);
  console.log("✅ testShortFriendlyReply passed");
}

// --- Medium reply → text_only ---

function testMediumReply() {
  const medium = "Это очень интересный вопрос который требует подробного ответа с множеством деталей и объяснений по разным аспектам и нюансам данной темы";
  // 150 chars — still under 200, but let's use something clearly in the 200-500 range
  const medium2 = medium + " " + "Дополнительные подробности которые делают текст достаточно длинным для того чтобы попасть в среднюю категорию".repeat(2);
  if (medium2.length <= 200) throw new Error(`Test text should be > 200, got ${medium2.length}`);
  const r = decideVoiceStrategy(medium2, cfg());
  if (r.mode !== "text_only") throw new Error(`Medium (${medium2.length}chars) should be text_only, got ${r.mode}`);
  console.log("✅ testMediumReply passed");
}

// --- Long reply → text_only ---

function testLongReply() {
  const long = "A".repeat(600);
  const r = decideVoiceStrategy(long, cfg());
  if (r.mode !== "text_only") throw new Error(`Long should be text_only, got ${r.mode}`);
  if (!r.reason.includes("too_long")) throw new Error(`Reason should mention too_long, got: ${r.reason}`);
  console.log("✅ testLongReply passed");
}

// --- Empty / commands → text_only ---

function testEmptyAndCommands() {
  const empty = decideVoiceStrategy("", cfg());
  if (empty.mode !== "text_only") throw new Error("Empty should be text_only");

  const cmd = decideVoiceStrategy("/start", cfg());
  if (cmd.mode !== "text_only") throw new Error("Command should be text_only");
  if (cmd.reason !== "command_input") throw new Error(`Command reason should be command_input, got: ${cmd.reason}`);

  const ws = decideVoiceStrategy("   ", cfg());
  if (ws.mode !== "text_only") throw new Error("Whitespace should be text_only");

  console.log("✅ testEmptyAndCommands passed");
}

// --- Kozy unavailable → text_only ---

function testKozyUnavailable() {
  const r = decideVoiceStrategy("Короткий ответ", { ...cfg(), kozyLive: false });
  if (r.mode !== "text_only") throw new Error(`Should be text_only when kozy dead, got ${r.mode}`);
  if (r.reason !== "kozy_unavailable") throw new Error(`Reason should be kozy_unavailable, got: ${r.reason}`);
  console.log("✅ testKozyUnavailable passed");
}

// --- False-positive provider check ---

function testNoFalsePositiveProvider() {
  const r = decideVoiceStrategy("ok", cfg());
  if (r.preferred_provider !== null) throw new Error(`No provider for text_only, got ${r.preferred_provider}`);

  const r2 = decideVoiceStrategy("Расскажи мне", cfg());
  if (r2.preferred_provider !== "kozy") throw new Error(`Provider should be kozy for voice_quality, got ${r2.preferred_provider}`);

  const r3 = decideVoiceStrategy("A".repeat(600), cfg());
  if (r3.preferred_provider !== null) throw new Error(`No provider for long text, got ${r3.preferred_provider}`);

  console.log("✅ testNoFalsePositiveProvider passed");
}

// --- Config overrides ---

function testConfigOverrides() {
  // Lower maxVoiceChars → more goes to text_only
  const r1 = decideVoiceStrategy("A".repeat(150), { ...cfg(), maxVoiceChars: 100 });
  if (r1.mode !== "text_only") throw new Error(`150 chars with maxVoiceChars=100 should be text_only, got ${r1.mode}`);

  // Higher hardTextLimit → medium goes to voice_quality
  const r2 = decideVoiceStrategy("A".repeat(400), { ...cfg(), maxVoiceChars: 500, hardTextLimit: 1000 });
  if (r2.mode !== "voice_quality") throw new Error(`400 chars with high limits should be voice_quality, got ${r2.mode}`);

  console.log("✅ testConfigOverrides passed");
}

// --- Backward compatibility ---

function testBackwardCompatibilityWithOldDefaults() {
  // Old default was 200 chars — same behavior for messages within 200
  const r = decideVoiceStrategy("привет", cfg());
  // "привет" is in ULTRA_SHORT_TOKENS → text_only
  if (r.mode !== "text_only") throw new Error(`Greeting should be text_only, got ${r.mode}`);

  const r2 = decideVoiceStrategy("Что думаешь об архитектуре?", cfg());
  if (r2.mode !== "voice_quality") throw new Error(`Should be voice_quality, got ${r2.mode}`);

  console.log("✅ testBackwardCompatibilityWithOldDefaults passed");
}

async function main() {
  testUltraShortAcks();
  testGreetings();
  testShortFriendlyReply();
  testMediumReply();
  testLongReply();
  testEmptyAndCommands();
  testKozyUnavailable();
  testNoFalsePositiveProvider();
  testConfigOverrides();
  testBackwardCompatibilityWithOldDefaults();
  console.log("\n✅ All voice strategy layer tests passed");
}

main().catch((e) => {
  console.error("❌ Test failed:", e);
  process.exit(1);
});
