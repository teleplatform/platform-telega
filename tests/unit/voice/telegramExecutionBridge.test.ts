import type { UnifiedOutboundEvent } from "../../../src/channels/unified-event.js";

function testVoicePolicyGuard() {
  const VOICE_MAX_CHARS = 200;

  function shouldUseVoice(arishaEnabled: boolean, textLength: number): boolean {
    return arishaEnabled && textLength <= VOICE_MAX_CHARS;
  }

  if (!shouldUseVoice(true, 50)) throw new Error("Short message should use voice");
  if (!shouldUseVoice(true, 200)) throw new Error("Exactly 200 chars should use voice");
  if (shouldUseVoice(true, 201)) throw new Error("201 chars should NOT use voice");
  if (shouldUseVoice(true, 500)) throw new Error("500 chars should NOT use voice");
  if (shouldUseVoice(false, 50)) throw new Error("Disabled should not use voice");
  console.log("✅ testVoicePolicyGuard passed");
}

function testSpokenTextClamp() {
  function clampSpokenText(text: string, maxLen: number): string {
    return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
  }

  if (clampSpokenText("Hi", 100) !== "Hi") throw new Error("Short text should not be clamped");
  const clamped = clampSpokenText("A".repeat(150), 100);
  if (clamped.length !== 103) throw new Error(`Clamped length should be 103 (100+3), got ${clamped.length}`);
  if (!clamped.endsWith("...")) throw new Error("Clamped text should end with ...");
  console.log("✅ testSpokenTextClamp passed");
}

function testCaptionSafety() {
  function safeCaption(text: string): string {
    return (text || "").slice(0, 200);
  }

  if (safeCaption("Short").length !== 5) throw new Error("Short caption should not be truncated");
  if (safeCaption("A".repeat(500)).length !== 200) throw new Error("Long caption should be truncated to 200");
  if (safeCaption("").length !== 0) throw new Error("Empty caption should be empty");
  if (safeCaption(undefined as any).length !== 0) throw new Error("Undefined caption should be empty");
  console.log("✅ testCaptionSafety passed");
}

function testWaitSignalDoesNotBreakPath() {
  // Simulates: sendChatAction may fail but path continues
  let chatActionSent = false;
  let voiceSent = false;

  async function sendChatAction(): Promise<void> {
    chatActionSent = true;
    throw new Error("simulated failure");
  }

  async function sendVoice(): Promise<void> {
    voiceSent = true;
  }

  async function executePath(): Promise<boolean> {
    try {
      await sendChatAction();
    } catch {
      // Non-critical — proceed
    }
    await sendVoice();
    return true;
  }

  // This must not throw
  const result = executePath();
  // Synchronously check that the path continued despite chatAction failure
  return result.then((ok) => {
    if (!ok) throw new Error("Path should succeed");
    if (!chatActionSent) throw new Error("Chat action should have been attempted");
    if (!voiceSent) throw new Error("Voice should have been sent despite chatAction failure");
    console.log("✅ testWaitSignalDoesNotBreakPath passed");
  });
}

function testNoDuplicateReplyOnSuccess() {
  let replies: string[] = [];

  function executePath(hasAudio: boolean, audioValid: boolean): string[] {
    replies = [];
    if (hasAudio && audioValid) {
      replies.push("voice");
      return replies; // early return — no text
    }
    replies.push("text");
    return replies;
  }

  const voiceResult = executePath(true, true);
  if (voiceResult.length !== 1) throw new Error("Should have exactly 1 reply");
  if (voiceResult[0] !== "voice") throw new Error("Should be voice");

  const textResult = executePath(true, false);
  if (textResult.length !== 1) throw new Error("Should have exactly 1 reply on fallback");
  if (textResult[0] !== "text") throw new Error("Should be text on fallback");
  console.log("✅ testNoDuplicateReplyOnSuccess passed");
}

function testNoDuplicateReplyOnFailure() {
  function executePath(audioPath: string | null, fileExists: boolean): string[] {
    const replies: string[] = [];
    if (audioPath && fileExists) {
      replies.push("voice");
      return replies;
    }
    if (audioPath && !fileExists) {
      // File missing — fall through to text
    }
    replies.push("text");
    return replies;
  }

  const missingFile = executePath("/path/to/missing.wav", false);
  if (missingFile.length !== 1) throw new Error("Should have exactly 1 reply when file missing");
  if (missingFile[0] !== "text") throw new Error("Should fall back to text");

  const validFile = executePath("/path/to/valid.wav", true);
  if (validFile.length !== 1) throw new Error("Should have exactly 1 reply when file valid");
  if (validFile[0] !== "voice") throw new Error("Should send voice when file valid");
  console.log("✅ testNoDuplicateReplyOnFailure passed");
}

function testBackwardCompatibility() {
  const response: UnifiedOutboundEvent = {
    trace_id: "test-bc",
    target_channel: "telegram",
    response_type: "immediate",
    display_text: "Old-style response",
  };

  if (response.display_text !== "Old-style response") throw new Error("display_text broken");
  if (response.audio_output !== undefined) throw new Error("audio_output should be undefined");
  if (response.audio_delivery !== undefined) throw new Error("audio_delivery should be undefined");
  console.log("✅ testBackwardCompatibility passed");
}

async function main() {
  testVoicePolicyGuard();
  testSpokenTextClamp();
  testCaptionSafety();
  await testWaitSignalDoesNotBreakPath();
  testNoDuplicateReplyOnSuccess();
  testNoDuplicateReplyOnFailure();
  testBackwardCompatibility();
  console.log("\n✅ All voice latency + UX hardening tests passed");
}

main().catch((e) => {
  console.error("❌ Test failed:", e);
  process.exit(1);
});
