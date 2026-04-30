import {
  registerLatestUserTurn,
  createVoiceInterruptionContext,
  evaluateVoiceInterruption,
  isVoiceSendStillSafe,
  getLatestTurnState,
  resetTurnState,
  resetAllTurnStates,
} from "../../../src/telegram/voiceInterruption.js";

// Clean slate before each test
function cleanup() {
  resetAllTurnStates();
}

// --- A: Same turn → safe to send ---

function testSameTurnSafeToSend() {
  cleanup();

  // Register initial turn
  registerLatestUserTurn({
    chatId: "chat1",
    userMessageId: "msg1",
    turnKey: "chat1:msg1",
  });

  // Create voice context for same turn
  const ctx = createVoiceInterruptionContext({
    chatId: "chat1",
    sourceUserMessageId: "msg1",
    sourceTurnKey: "chat1:msg1",
  });

  const decision = evaluateVoiceInterruption(ctx);

  if (decision.status !== "safe_to_send") throw new Error(`Expected safe_to_send, got ${decision.status}`);
  if (decision.shouldCancelVoiceSend) throw new Error("Should not cancel for same turn");
  if (!decision.shouldAllowVoiceSend) throw new Error("Should allow send for same turn");
  if (decision.wasSuperseded) throw new Error("Should not be superseded for same turn");
  if (decision.supersededByTurnKey) throw new Error("Should have no supersededByTurnKey for same turn");

  console.log("✅ testSameTurnSafeToSend passed");
}

// --- B: Newer user turn registered → old voice becomes superseded ---

function testNewerTurnSupersedesOld() {
  cleanup();

  // Register first turn
  registerLatestUserTurn({
    chatId: "chat1",
    userMessageId: "msg1",
    turnKey: "chat1:msg1",
  });

  // Voice is being prepared for msg1
  const ctx = createVoiceInterruptionContext({
    chatId: "chat1",
    sourceUserMessageId: "msg1",
    sourceTurnKey: "chat1:msg1",
  });

  // User sends new message BEFORE voice is sent
  registerLatestUserTurn({
    chatId: "chat1",
    userMessageId: "msg2",
    turnKey: "chat1:msg2",
  });

  // Now check if voice for msg1 is still safe
  const decision = evaluateVoiceInterruption(ctx);

  if (decision.status !== "superseded") throw new Error(`Expected superseded, got ${decision.status}`);
  if (!decision.shouldCancelVoiceSend) throw new Error("Should cancel for superseded turn");
  if (decision.shouldAllowVoiceSend) throw new Error("Should not allow send for superseded turn");
  if (!decision.wasSuperseded) throw new Error("Should be superseded");
  if (decision.supersededByTurnKey !== "chat1:msg2") throw new Error(`Expected supersededBy msg2, got ${decision.supersededByTurnKey}`);
  if (decision.supersededByMessageId !== "msg2") throw new Error(`Expected supersededBy msg2, got ${decision.supersededByMessageId}`);

  console.log("✅ testNewerTurnSupersedesOld passed");
}

// --- C: No false cancellation for same message ---

function testNoFalseCancellation() {
  cleanup();

  // Register turn
  registerLatestUserTurn({
    chatId: "chat1",
    userMessageId: "msg1",
    turnKey: "chat1:msg1",
  });

  // Create context and evaluate multiple times
  const ctx = createVoiceInterruptionContext({
    chatId: "chat1",
    sourceUserMessageId: "msg1",
    sourceTurnKey: "chat1:msg1",
  });

  for (let i = 0; i < 5; i++) {
    const decision = evaluateVoiceInterruption(ctx);
    if (decision.shouldCancelVoiceSend) {
      throw new Error(`False cancellation on iteration ${i}`);
    }
  }

  console.log("✅ testNoFalseCancellation passed");
}

// --- D: Different chat isolation → chat A interruption must not affect chat B ---

function testDifferentChatIsolation() {
  cleanup();

  // Register turn for chat A
  registerLatestUserTurn({
    chatId: "chatA",
    userMessageId: "msgA1",
    turnKey: "chatA:msgA1",
  });

  // Register turn for chat B
  registerLatestUserTurn({
    chatId: "chatB",
    userMessageId: "msgB1",
    turnKey: "chatB:msgB1",
  });

  // New message in chat A supersedes A's voice
  registerLatestUserTurn({
    chatId: "chatA",
    userMessageId: "msgA2",
    turnKey: "chatA:msgA2",
  });

  // Chat A voice should be superseded
  const ctxA = createVoiceInterruptionContext({
    chatId: "chatA",
    sourceUserMessageId: "msgA1",
    sourceTurnKey: "chatA:msgA1",
  });
  const decisionA = evaluateVoiceInterruption(ctxA);
  if (!decisionA.shouldCancelVoiceSend) throw new Error("Chat A voice should be cancelled");

  // Chat B voice should still be safe
  const ctxB = createVoiceInterruptionContext({
    chatId: "chatB",
    sourceUserMessageId: "msgB1",
    sourceTurnKey: "chatB:msgB1",
  });
  const decisionB = evaluateVoiceInterruption(ctxB);
  if (decisionB.shouldCancelVoiceSend) throw new Error("Chat B voice should NOT be cancelled (isolated from A)");
  if (decisionB.status !== "safe_to_send") throw new Error(`Chat B should be safe_to_send, got ${decisionB.status}`);

  console.log("✅ testDifferentChatIsolation passed");
}

// --- E: Pre-send stale gate works deterministically ---

function testPreSendStaleGateDeterministic() {
  cleanup();

  // Register turn
  registerLatestUserTurn({
    chatId: "chat1",
    userMessageId: "msg1",
    turnKey: "chat1:msg1",
  });

  const ctx = createVoiceInterruptionContext({
    chatId: "chat1",
    sourceUserMessageId: "msg1",
    sourceTurnKey: "chat1:msg1",
  });

  // Evaluate multiple times — should always be the same
  for (let i = 0; i < 10; i++) {
    const decision = evaluateVoiceInterruption(ctx);
    if (decision.status !== "safe_to_send") throw new Error(`Iteration ${i}: expected safe_to_send, got ${decision.status}`);
    if (!decision.shouldAllowVoiceSend) throw new Error(`Iteration ${i}: should allow send`);
  }

  // Now supersede
  registerLatestUserTurn({
    chatId: "chat1",
    userMessageId: "msg2",
    turnKey: "chat1:msg2",
  });

  // Now should always be superseded
  for (let i = 0; i < 10; i++) {
    const decision = evaluateVoiceInterruption(ctx);
    if (decision.status !== "superseded") throw new Error(`After supersede iteration ${i}: expected superseded, got ${decision.status}`);
    if (!decision.shouldCancelVoiceSend) throw new Error(`After supersede iteration ${i}: should cancel`);
  }

  console.log("✅ testPreSendStaleGateDeterministic passed");
}

// --- F: First-audio path remains interruption-safe ---

function testFirstAudioPathInterruptionSafe() {
  cleanup();

  // Register turn
  registerLatestUserTurn({
    chatId: "chat1",
    userMessageId: "msg1",
    turnKey: "chat1:msg1",
  });

  const ctx = createVoiceInterruptionContext({
    chatId: "chat1",
    sourceUserMessageId: "msg1",
    sourceTurnKey: "chat1:msg1",
  });

  // First audio path uses same interruption context
  const safeBefore = isVoiceSendStillSafe(ctx);
  if (!safeBefore) throw new Error("First audio should be safe before supersession");

  // User sends new message
  registerLatestUserTurn({
    chatId: "chat1",
    userMessageId: "msg2",
    turnKey: "chat1:msg2",
  });

  // First audio should now be unsafe
  const safeAfter = isVoiceSendStillSafe(ctx);
  if (safeAfter) throw new Error("First audio should be unsafe after supersession");

  console.log("✅ testFirstAudioPathInterruptionSafe passed");
}

// --- G: Latest turn always wins ---

function testLatestTurnAlwaysWins() {
  cleanup();

  // Simulate rapid-fire messages
  for (let i = 1; i <= 10; i++) {
    registerLatestUserTurn({
      chatId: "chat1",
      userMessageId: `msg${i}`,
      turnKey: `chat1:msg${i}`,
    });
  }

  // Voice for msg1 should be superseded
  const ctx1 = createVoiceInterruptionContext({
    chatId: "chat1",
    sourceUserMessageId: "msg1",
    sourceTurnKey: "chat1:msg1",
  });
  const decision1 = evaluateVoiceInterruption(ctx1);
  if (!decision1.shouldCancelVoiceSend) throw new Error("msg1 voice should be cancelled");

  // Voice for msg10 should be safe
  const ctx10 = createVoiceInterruptionContext({
    chatId: "chat1",
    sourceUserMessageId: "msg10",
    sourceTurnKey: "chat1:msg10",
  });
  const decision10 = evaluateVoiceInterruption(ctx10);
  if (decision10.shouldCancelVoiceSend) throw new Error("msg10 voice should be safe (latest turn)");
  if (decision10.status !== "safe_to_send") throw new Error(`msg10 should be safe_to_send, got ${decision10.status}`);

  // State should reflect msg10
  const state = getLatestTurnState("chat1");
  if (!state || state.latestTurnKey !== "chat1:msg10") throw new Error(`Latest turn should be msg10, got ${state?.latestTurnKey}`);

  console.log("✅ testLatestTurnAlwaysWins passed");
}

// --- H: Hints and warnings are meaningful ---

function testHintsAndWarningsMeaningful() {
  cleanup();

  // Safe turn should have appropriate hints
  registerLatestUserTurn({
    chatId: "chat1",
    userMessageId: "msg1",
    turnKey: "chat1:msg1",
  });

  const ctxSafe = createVoiceInterruptionContext({
    chatId: "chat1",
    sourceUserMessageId: "msg1",
    sourceTurnKey: "chat1:msg1",
  });
  const safeDecision = evaluateVoiceInterruption(ctxSafe);
  if (safeDecision.hints.length === 0) throw new Error("Safe decision should have hints");
  if (!safeDecision.hints.includes("latest_turn_still_current")) throw new Error("Safe decision should hint latest_turn_still_current");

  // Superseded turn should have warnings
  registerLatestUserTurn({
    chatId: "chat1",
    userMessageId: "msg2",
    turnKey: "chat1:msg2",
  });

  const supersededDecision = evaluateVoiceInterruption(ctxSafe);
  if (supersededDecision.warnings.length === 0) throw new Error("Superseded decision should have warnings");
  if (!supersededDecision.warnings.includes("voice_response_superseded")) throw new Error("Should warn voice_response_superseded");
  if (!supersededDecision.warnings.includes("stale_audio_prevented")) throw new Error("Should warn stale_audio_prevented");

  console.log("✅ testHintsAndWarningsMeaningful passed");
}

// --- I: isVoiceSendStillSafe convenience function ---

function testIsVoiceSendStillSafe() {
  cleanup();

  registerLatestUserTurn({
    chatId: "chat1",
    userMessageId: "msg1",
    turnKey: "chat1:msg1",
  });

  const ctx = createVoiceInterruptionContext({
    chatId: "chat1",
    sourceUserMessageId: "msg1",
    sourceTurnKey: "chat1:msg1",
  });

  if (!isVoiceSendStillSafe(ctx)) throw new Error("Should be safe initially");

  registerLatestUserTurn({
    chatId: "chat1",
    userMessageId: "msg2",
    turnKey: "chat1:msg2",
  });

  if (isVoiceSendStillSafe(ctx)) throw new Error("Should be unsafe after supersession");

  console.log("✅ testIsVoiceSendStillSafe passed");
}

// --- J: No turn registry for chat → defaults to safe ---

function testNoTurnRegistryDefaultsToSafe() {
  cleanup();

  // Don't register any turn for chat2
  const ctx = createVoiceInterruptionContext({
    chatId: "chat2",
    sourceUserMessageId: "msg1",
    sourceTurnKey: "chat2:msg1",
  });

  const decision = evaluateVoiceInterruption(ctx);

  // No registry → should default to safe (can't check supersession)
  if (decision.shouldCancelVoiceSend) throw new Error("Should not cancel when no turn registry exists");
  if (!decision.shouldAllowVoiceSend) throw new Error("Should allow send when no turn registry exists");

  console.log("✅ testNoTurnRegistryDefaultsToSafe passed");
}

async function main() {
  testSameTurnSafeToSend();
  testNewerTurnSupersedesOld();
  testNoFalseCancellation();
  testDifferentChatIsolation();
  testPreSendStaleGateDeterministic();
  testFirstAudioPathInterruptionSafe();
  testLatestTurnAlwaysWins();
  testHintsAndWarningsMeaningful();
  testIsVoiceSendStillSafe();
  testNoTurnRegistryDefaultsToSafe();
  console.log("\n✅ All voice interruption/barge-in tests passed");
}

main().catch((e) => {
  console.error("❌ Test failed:", e);
  process.exit(1);
});
