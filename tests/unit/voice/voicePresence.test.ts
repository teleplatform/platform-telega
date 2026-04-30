import {
  decidePresenceMode,
  applyPresenceShaping,
  updateContextAfterResponse,
  createFreshContext,
  classifyInteractionType,
  type PresenceContext,
  type VoiceStyleMode,
} from "../../../src/telegram/voicePresence.js";

function freshCtx(): PresenceContext {
  return createFreshContext();
}

function withHistory(overrides: Partial<PresenceContext>): PresenceContext {
  return { ...createFreshContext(), ...overrides };
}

// --- Greeting → follow-up produces "continuing" ---

function testGreetingFollowUp() {
  const ctx = withHistory({
    lastInteractionType: "greeting",
    lastStyleMode: "warm" as VoiceStyleMode,
    interactionCount: 1,
    lastInteractionAt: Date.now() - 1000,
  });

  const r = decidePresenceMode("Как дела?", "warm", ctx);
  if (r !== "continuing") throw new Error(`Greeting follow-up should be continuing, got ${r}`);
  console.log("✅ testGreetingFollowUp passed");
}

// --- Repeated concise replies remain concise without duplication ---

function testRepeatedConcise() {
  const ctx = withHistory({
    lastInteractionType: "concise",
    lastStyleMode: "concise" as VoiceStyleMode,
    lastResponseWasVoice: true,
    interactionCount: 2,
    lastInteractionAt: Date.now() - 500,
  });

  const r = decidePresenceMode("Ок, понял", "concise", ctx);
  if (r !== "continuing") throw new Error(`Repeated concise should be continuing, got ${r}`);
  console.log("✅ testRepeatedConcise passed");
}

// --- Supportive tone not duplicated excessively ---

function testSupportiveNotDuplicated() {
  const ctx = withHistory({
    lastInteractionType: "support",
    lastStyleMode: "supportive" as VoiceStyleMode,
    interactionCount: 1,
    lastInteractionAt: Date.now() - 2000,
  });

  // User responds with concise acknowledgment after support
  const r = decidePresenceMode("Спасибо", "concise", ctx);
  if (r !== "soft_followup") throw new Error(`After support, concise response should be soft_followup, got ${r}`);
  console.log("✅ testSupportiveNotDuplicated passed");
}

// --- Neutral info remains neutral ---

function testNeutralInfo() {
  const ctx = withHistory({
    lastInteractionType: "neutral",
    lastStyleMode: "neutral" as VoiceStyleMode,
    interactionCount: 1,
    lastInteractionAt: Date.now() - 1000,
  });

  const r = decidePresenceMode("Расскажи об архитектуре системы", "neutral", ctx);
  if (r !== "continuing") throw new Error(`Neutral follow-up should be continuing, got ${r}`);
  console.log("✅ testNeutralInfo passed");
}

// --- No semantic drift ---

function testNoSemanticDrift() {
  const ctx = freshCtx();

  const original = "Завтра встреча в 10 утра";
  const presence = decidePresenceMode(original, "neutral", ctx);
  const shaped = applyPresenceShaping(original, presence, "neutral", ctx);

  // Fresh context → no shaping
  if (shaped.textAdjusted !== false) throw new Error("Fresh context should not adjust text");
  if (shaped.shapedText !== original) throw new Error("Text should not change in fresh context");
  console.log("✅ testNoSemanticDrift passed");
}

// --- Reset behavior works ---

function testResetBehavior() {
  // Long gap (> 5 minutes)
  const ctx = withHistory({
    lastInteractionType: "support",
    lastStyleMode: "supportive" as VoiceStyleMode,
    interactionCount: 3,
    lastInteractionAt: Date.now() - 10 * 60 * 1000, // 10 minutes ago
  });

  const r = decidePresenceMode("Что нового?", "neutral", ctx);
  if (r !== "reset") throw new Error(`Long gap should trigger reset, got ${r}`);
  console.log("✅ testResetBehavior passed");
}

// --- Reset on topic shift after support ---

function testResetOnTopicShift() {
  const ctx = withHistory({
    lastInteractionType: "support",
    lastStyleMode: "supportive" as VoiceStyleMode,
    interactionCount: 2,
    lastInteractionAt: Date.now() - 30000, // 30 seconds ago
  });

  // User asks completely unrelated question
  const r = decidePresenceMode("Расскажи про архитектуру?", "neutral", ctx);
  if (r !== "reset") throw new Error(`Topic shift after support should reset, got ${r}`);
  console.log("✅ testResetOnTopicShift passed");
}

// --- Presence never injects new facts ---

function testPresenceNeverInjectsFacts() {
  const ctx = withHistory({
    lastInteractionType: "greeting",
    lastStyleMode: "warm" as VoiceStyleMode,
    interactionCount: 2,
    lastResponseWasVoice: true,
    lastInteractionAt: Date.now() - 500,
  });

  const original = "Хорошо, давай обсудим";
  const presence = decidePresenceMode(original, "warm", ctx);
  const shaped = applyPresenceShaping(original, presence, "warm", ctx);

  // Continuing with voice history → might remove repeated opener
  if (shaped.textAdjusted) {
    // If adjusted, should not add any new content
    if (shaped.shapedText.length > original.length) {
      throw new Error("Presence should never expand text");
    }
  }
  console.log("✅ testPresenceNeverInjectsFacts passed");
}

// --- Context update after response ---

function testContextUpdateAfterResponse() {
  const ctx = freshCtx();
  const updated = updateContextAfterResponse(ctx, "greeting", "warm", true);

  if (updated.lastInteractionType !== "greeting") throw new Error("Interaction type should update");
  if (updated.lastStyleMode !== "warm") throw new Error("Style mode should update");
  if (updated.lastResponseWasVoice !== true) throw new Error("Voice flag should update");
  if (updated.interactionCount !== 1) throw new Error("Count should increment");
  if (updated.lastInteractionAt <= 0) throw new Error("Timestamp should be set");
  console.log("✅ testContextUpdateAfterResponse passed");
}

// --- Context update caps at 5 ---

function testContextCapsAt5() {
  const ctx = withHistory({ interactionCount: 5 });
  const updated = updateContextAfterResponse(ctx, "neutral", "neutral", false);
  if (updated.interactionCount !== 5) throw new Error("Count should cap at 5");
  console.log("✅ testContextCapsAt5 passed");
}

// --- Interaction type classification ---

function testInteractionTypeClassification() {
  if (classifyInteractionType("привет") !== "greeting") throw new Error("привет should be greeting");
  if (classifyInteractionType("мне нужна поддержка") !== "support") throw new Error("support should be support");
  if (classifyInteractionType("ок") !== "concise") throw new Error("ок should be concise");
  if (classifyInteractionType("Расскажи подробнее") !== "neutral") throw new Error("neutral should be neutral");
  console.log("✅ testInteractionTypeClassification passed");
}

// --- Fresh mode has no shaping ---

function testFreshModeNoShaping() {
  const ctx = freshCtx();
  const presence = decidePresenceMode("Привет!", "warm", ctx);
  const shaped = applyPresenceShaping("Привет!", presence, "warm", ctx);

  if (presence !== "fresh") throw new Error(`Fresh context should yield fresh mode, got ${presence}`);
  if (shaped.textAdjusted !== false) throw new Error("Fresh mode should not adjust text");
  console.log("✅ testFreshModeNoShaping passed");
}

async function main() {
  testGreetingFollowUp();
  testRepeatedConcise();
  testSupportiveNotDuplicated();
  testNeutralInfo();
  testNoSemanticDrift();
  testResetBehavior();
  testResetOnTopicShift();
  testPresenceNeverInjectsFacts();
  testContextUpdateAfterResponse();
  testContextCapsAt5();
  testInteractionTypeClassification();
  testFreshModeNoShaping();
  console.log("\n✅ All voice presence/relationship tests passed");
}

main().catch((e) => {
  console.error("❌ Test failed:", e);
  process.exit(1);
});
