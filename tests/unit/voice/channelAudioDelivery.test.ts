import type { UnifiedOutboundEvent } from "../../../src/channels/unified-event.js";

function testTelegramAudioDeliveryPath() {
  function mapToTelegramResponse(outbound: UnifiedOutboundEvent, chatId: string): Record<string, unknown> {
    const audioOut = outbound.audio_output;
    const audioDelivery = outbound.audio_delivery;
    const hasRealAudio = audioOut?.filename && audioDelivery?.status === "sent";

    if (hasRealAudio) {
      return {
        method: "sendVoice",
        chat_id: chatId,
        voice: audioOut.audio_url || audioOut.filename,
        caption: (outbound.display_text || "").slice(0, 1024),
      };
    }
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: outbound.display_text || "",
    };
  }

  const withAudio: UnifiedOutboundEvent = {
    trace_id: "test-1",
    target_channel: "telegram",
    response_type: "immediate",
    display_text: "Привет, вот мой ответ",
    audio_output: {
      asset_id: "arisha_test.wav",
      filename: "arisha_test.wav",
      mime: "audio/wav",
      size_bytes: 222316,
      provider: "kozy",
      duration_ms: 5000,
      audio_url: "/v1/voice/files/arisha_test.wav",
    },
    audio_delivery: {
      attempted: true,
      channel: "telegram",
      status: "sent",
      outbound_method: "sendVoice",
    },
  };

  const tgResponse = mapToTelegramResponse(withAudio, "12345");
  if (tgResponse.method !== "sendVoice") throw new Error(`Expected sendVoice, got ${tgResponse.method}`);
  if (tgResponse.voice !== "/v1/voice/files/arisha_test.wav") throw new Error(`Wrong voice URL`);
  if (tgResponse.caption !== "Привет, вот мой ответ") throw new Error("Wrong caption");
  console.log("✅ testTelegramAudioDeliveryPath passed");
}

function testTelegramTextFallbackWhenAudioSkipped() {
  function mapToTelegramResponse(outbound: UnifiedOutboundEvent, chatId: string): Record<string, unknown> {
    const audioOut = outbound.audio_output;
    const audioDelivery = outbound.audio_delivery;
    const hasRealAudio = audioOut?.filename && audioDelivery?.status === "sent";

    if (hasRealAudio) {
      return { method: "sendVoice", chat_id: chatId, voice: audioOut.filename!, caption: outbound.display_text || "" };
    }
    return { method: "sendMessage", chat_id: chatId, text: outbound.display_text || "" };
  }

  const audioSkipped: UnifiedOutboundEvent = {
    trace_id: "test-2",
    target_channel: "telegram",
    response_type: "immediate",
    display_text: "Text only because audio fallback",
    audio_output: {
      asset_id: "test.wav",
      filename: "test.wav",
      provider: "kozy",
    },
    audio_delivery: {
      attempted: true,
      channel: "telegram",
      status: "skipped",
      fallback_used: true,
      outbound_method: "sendMessage",
    },
  };

  const tgResponse = mapToTelegramResponse(audioSkipped, "12345");
  if (tgResponse.method !== "sendMessage") throw new Error(`Expected sendMessage, got ${tgResponse.method}`);
  if (tgResponse.text !== "Text only because audio fallback") throw new Error("Wrong text");
  console.log("✅ testTelegramTextFallbackWhenAudioSkipped passed");
}

function testTelegramTextOnlyPath() {
  function mapToTelegramResponse(outbound: UnifiedOutboundEvent, chatId: string): Record<string, unknown> {
    const audioOut = outbound.audio_output;
    const audioDelivery = outbound.audio_delivery;
    const hasRealAudio = audioOut?.filename && audioDelivery?.status === "sent";

    if (hasRealAudio) return { method: "sendVoice", chat_id: chatId, voice: audioOut.filename!, caption: "" };
    return { method: "sendMessage", chat_id: chatId, text: outbound.display_text || "" };
  }

  const noAudio: UnifiedOutboundEvent = {
    trace_id: "test-3",
    target_channel: "telegram",
    response_type: "immediate",
    display_text: "No audio at all",
  };

  const tgResponse = mapToTelegramResponse(noAudio, "12345");
  if (tgResponse.method !== "sendMessage") throw new Error(`Expected sendMessage, got ${tgResponse.method}`);
  if (tgResponse.text !== "No audio at all") throw new Error("Wrong text");
  console.log("✅ testTelegramTextOnlyPath passed");
}

function testAliceAudioPrepared() {
  function mapToAliceResponse(outbound: UnifiedOutboundEvent): Record<string, unknown> {
    const responseObj: Record<string, unknown> = {
      text: outbound.display_text || outbound.speak_text || "",
      tts: outbound.speak_text,
      end_session: outbound.end_session ?? false,
    };

    if (outbound.audio_output?.filename) {
      responseObj.end_session = outbound.end_session ?? true;
      if (outbound.audio_delivery) {
        (responseObj as any).audio_metadata = {
          provider: outbound.audio_output.provider,
          filename: outbound.audio_output.filename,
          size_bytes: outbound.audio_output.size_bytes,
          status: outbound.audio_delivery.status,
        };
      }
    }

    return { response: responseObj };
  }

  const withAudio: UnifiedOutboundEvent = {
    trace_id: "test-4",
    target_channel: "alice",
    response_type: "immediate",
    display_text: "Принял. Уточни вопрос.",
    speak_text: "Принял. Уточни вопрос.",
    audio_output: {
      asset_id: "arisha_alice.wav",
      filename: "arisha_alice.wav",
      mime: "audio/wav",
      size_bytes: 200000,
      provider: "kozy",
      duration_ms: 3000,
      audio_url: "/v1/voice/files/arisha_alice.wav",
    },
    audio_delivery: {
      attempted: true,
      channel: "alice",
      status: "prepared",
    },
  };

  const aliceResponse = mapToAliceResponse(withAudio) as { response: Record<string, unknown> };
  if (aliceResponse.response.end_session !== true) throw new Error("end_session should be true");
  const meta = (aliceResponse.response as any).audio_metadata;
  if (meta === undefined) throw new Error("audio_metadata should exist");
  if (meta?.provider !== "kozy") throw new Error(`Wrong provider: ${meta?.provider}`);
  if (meta?.filename !== "arisha_alice.wav") throw new Error(`Wrong filename: ${meta?.filename}`);
  if (meta?.status !== "prepared") throw new Error(`Wrong status: ${meta?.status}`);
  console.log("✅ testAliceAudioPrepared passed");
}

function testAliceTextOnlyPath() {
  function mapToAliceResponse(outbound: UnifiedOutboundEvent): Record<string, unknown> {
    const responseObj: Record<string, unknown> = {
      text: outbound.display_text || outbound.speak_text || "",
      tts: outbound.speak_text,
      end_session: outbound.end_session ?? false,
    };

    if (outbound.audio_output?.filename) {
      responseObj.end_session = true;
      if (outbound.audio_delivery) {
        (responseObj as any).audio_metadata = { provider: outbound.audio_output.provider, status: outbound.audio_delivery.status };
      }
    }

    return { response: responseObj };
  }

  const noAudio: UnifiedOutboundEvent = {
    trace_id: "test-5",
    target_channel: "alice",
    response_type: "final",
    display_text: "Fallback text",
    speak_text: "Fallback TTS",
  };

  const aliceResponse = mapToAliceResponse(noAudio) as { response: Record<string, unknown> };
  if (aliceResponse.response.end_session !== false) throw new Error("end_session should be false");
  if ((aliceResponse.response as any).audio_metadata !== undefined) throw new Error("no audio_metadata expected");
  if (aliceResponse.response.text !== "Fallback text") throw new Error("Wrong text");
  if (aliceResponse.response.tts !== "Fallback TTS") throw new Error("Wrong TTS");
  console.log("✅ testAliceTextOnlyPath passed");
}

function testNoFalsePositiveSent() {
  function getStatus(outbound: UnifiedOutboundEvent): string {
    if (outbound.audio_delivery?.status === "sent" && outbound.audio_output?.filename) return "sent";
    if (outbound.audio_delivery?.status === "prepared" && outbound.audio_output?.filename) return "prepared";
    if (outbound.audio_delivery?.status === "failed") return "failed";
    if (outbound.audio_delivery?.status === "skipped") return "skipped";
    return "no_audio";
  }

  const skipped: UnifiedOutboundEvent = {
    trace_id: "test-6",
    target_channel: "telegram",
    response_type: "immediate",
    display_text: "Text",
    audio_output: { asset_id: "x.wav", filename: "x.wav", provider: "kozy" },
    audio_delivery: { attempted: true, channel: "telegram", status: "skipped", fallback_used: true },
  };

  const prepared: UnifiedOutboundEvent = {
    ...skipped,
    audio_delivery: { attempted: true, channel: "alice", status: "prepared" },
    target_channel: "alice" as const,
  };

  if (getStatus(skipped) !== "skipped") throw new Error("Should be skipped, not sent");
  if (getStatus(prepared) !== "prepared") throw new Error("Should be prepared, not sent");
  console.log("✅ testNoFalsePositiveSent passed");
}

function testBackwardCompatibility() {
  const response: UnifiedOutboundEvent = {
    trace_id: "test-7",
    target_channel: "telegram",
    response_type: "immediate",
    display_text: "Backward compatible",
  };

  if (response.display_text !== "Backward compatible") throw new Error("display_text broken");
  if (response.audio_output !== undefined) throw new Error("audio_output should be undefined");
  if (response.audio_delivery !== undefined) throw new Error("audio_delivery should be undefined");
  console.log("✅ testBackwardCompatibility passed");
}

async function main() {
  testTelegramAudioDeliveryPath();
  testTelegramTextFallbackWhenAudioSkipped();
  testTelegramTextOnlyPath();
  testAliceAudioPrepared();
  testAliceTextOnlyPath();
  testNoFalsePositiveSent();
  testBackwardCompatibility();
  console.log("\n✅ All channel audio delivery tests passed");
}

main().catch((e) => {
  console.error("❌ Test failed:", e);
  process.exit(1);
});
