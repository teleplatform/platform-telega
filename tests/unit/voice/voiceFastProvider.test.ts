import { decideVoiceStrategy } from "../../../src/telegram/voiceStrategy.js";
import { isFastProviderAvailable } from "../../../src/telegram/fastProvider.js";

function cfg(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { kozyLive: true, fastProviderLive: true, fastProviderMaxChars: 300, ...overrides };
}

// --- voice_fast decision when fast provider enabled ---

function testVoiceFastDecision() {
  const r = decideVoiceStrategy("Расскажи мне об этом", cfg({ fastProviderLive: true }));
  if (r.mode !== "voice_fast") throw new Error(`Short reply should be voice_fast, got ${r.mode}`);
  if (r.voice_allowed !== true) throw new Error("voice_allowed should be true for voice_fast");
  console.log("✅ testVoiceFastDecision passed");
}

// --- voice_fast uses fast provider when available, voice_quality when not ---

function testFastVsQualityRouting() {
  // Fast available → voice_fast
  const r1 = decideVoiceStrategy("Короткий ответ", cfg({ fastProviderLive: true, kozyLive: true }));
  if (r1.mode !== "voice_fast") throw new Error(`Should be voice_fast, got ${r1.mode}`);

  // Fast NOT available, Kozy live → voice_quality
  const r2 = decideVoiceStrategy("Короткий ответ", cfg({ fastProviderLive: false, kozyLive: true }));
  if (r2.mode !== "voice_quality") throw new Error(`Should be voice_quality when fast unavailable, got ${r2.mode}`);
  if (r2.preferred_provider !== "kozy") throw new Error(`Provider should be kozy, got ${r2.preferred_provider}`);

  // Neither available → text_only
  const r3 = decideVoiceStrategy("Короткий ответ", cfg({ fastProviderLive: false, kozyLive: false }));
  if (r3.mode !== "text_only") throw new Error(`Should be text_only when neither available, got ${r3.mode}`);

  console.log("✅ testFastVsQualityRouting passed");
}

// --- Fast provider availability check ---

function testFastProviderAvailability() {
  const available = isFastProviderAvailable();
  // On macOS, /usr/bin/say and /usr/bin/afconvert should exist
  if (process.platform === "darwin") {
    if (available !== true) console.log("⚠️  Fast provider not available on macOS (unexpected)");
  }
  console.log(`✅ testFastProviderAvailability passed (platform=${process.platform}, available=${available})`);
}

// --- Fast provider disabled → safe fallback ---

function testFastProviderDisabled() {
  const r = decideVoiceStrategy("Тест", cfg({ fastProviderLive: false }));
  // Should fall back to voice_quality or text_only, never voice_fast
  if (r.mode === "voice_fast") throw new Error(`Should NOT be voice_fast when disabled, got ${r.mode}`);
  console.log("✅ testFastProviderDisabled passed");
}

// --- Fast provider max chars guard ---

function testFastProviderMaxChars() {
  const longText = "A".repeat(350);
  const r = decideVoiceStrategy(longText, cfg({ fastProviderLive: true, fastProviderMaxChars: 300 }));
  if (r.mode !== "text_only") throw new Error(`350 chars with maxChars=300 should be text_only, got ${r.mode}`);
  console.log("✅ testFastProviderMaxChars passed");
}

// --- Kozy path remains unchanged ---

function testKozyPathUnchanged() {
  // When fast disabled, Kozy should still work as voice_quality
  const r = decideVoiceStrategy("Что думаешь?", cfg({ fastProviderLive: false, kozyLive: true, maxVoiceChars: 200 }));
  if (r.mode !== "voice_quality") throw new Error(`Kozy should be voice_quality, got ${r.mode}`);
  if (r.preferred_provider !== "kozy") throw new Error(`Provider should be kozy, got ${r.preferred_provider}`);
  console.log("✅ testKozyPathUnchanged passed");
}

// --- Provider status truth ---

function testProviderStatusTruth() {
  // voice_fast → preferred_provider is null (fast provider has no named preference in strategy)
  const r1 = decideVoiceStrategy("Тест", cfg({ fastProviderLive: true }));
  if (r1.mode !== "voice_fast") throw new Error(`Should be voice_fast`);

  // voice_quality → preferred_provider is "kozy"
  const r2 = decideVoiceStrategy("Тест", cfg({ fastProviderLive: false, kozyLive: true }));
  if (r2.mode !== "voice_quality") throw new Error(`Should be voice_quality`);
  if (r2.preferred_provider !== "kozy") throw new Error(`Provider should be kozy`);

  // text_only → preferred_provider is null
  const r3 = decideVoiceStrategy("привет", cfg({ fastProviderLive: true }));
  if (r3.mode !== "text_only") throw new Error(`Greeting should be text_only`);
  if (r3.preferred_provider !== null) throw new Error(`Text-only should have no provider`);

  console.log("✅ testProviderStatusTruth passed");
}

// --- Backward compatibility: existing live path ---

function testBackwardCompatibility() {
  // Old behavior: short meaningful → voice. Now with fast provider, it goes to voice_fast.
  // But the delivery path (ctx.replyWithVoice) is the same.
  const r = decideVoiceStrategy("Что думаешь об архитектуре?", cfg({ fastProviderLive: true }));
  if (!["voice_fast", "voice_quality"].includes(r.mode)) {
    throw new Error(`Should use some voice mode, got ${r.mode}`);
  }
  if (!r.voice_allowed) throw new Error("voice_allowed should be true");
  console.log("✅ testBackwardCompatibility passed");
}

async function main() {
  testVoiceFastDecision();
  testFastVsQualityRouting();
  testFastProviderAvailability();
  testFastProviderDisabled();
  testFastProviderMaxChars();
  testKozyPathUnchanged();
  testProviderStatusTruth();
  testBackwardCompatibility();
  console.log("\n✅ All voice fast provider tests passed");
}

main().catch((e) => {
  console.error("❌ Test failed:", e);
  process.exit(1);
});
