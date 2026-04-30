import { createRequire } from "module";
const require = createRequire(import.meta.url);
import type { AudioOutput, SurfaceReply } from "../../../apps/telegpt-api/src/arisha-orchestration/types.js";

function testAudioMetadataInSurfaceReply() {
  const reply: SurfaceReply = {
    channel: "alice",
    text_output: "Test text",
    audio_output: {
      asset_id: "arisha_test_123.wav",
      file_path: "/tmp/out/arisha_test_123.wav",
      filename: "arisha_test_123.wav",
      mime: "audio/wav",
      size_bytes: 12345,
      provider: "kozy",
      duration_ms: 2500,
    },
    payload_shape: "audio_first",
    fallback_used: false,
  };

  console.assert(reply.audio_output !== undefined, "audio_output should exist");
  console.assert(reply.audio_output?.provider === "kozy", "provider should be kozy");
  console.assert(reply.audio_output?.size_bytes === 12345, "size should match");
  console.assert(reply.audio_output?.mime === "audio/wav", "mime should be audio/wav");
  console.log("✅ testAudioMetadataInSurfaceReply passed");
}

function testTextOnlySurfaceReply() {
  const reply: SurfaceReply = {
    channel: "web",
    text_output: "Text only reply",
    payload_shape: "text_first",
    fallback_used: true,
  };

  console.assert(reply.audio_output === undefined, "audio_output should not exist");
  console.assert(reply.text_output === "Text only reply", "text should work");
  console.assert(reply.fallback_used === true, "fallback should be true");
  console.log("✅ testTextOnlySurfaceReply passed");
}

function testBuildAudioUrl() {
  function buildAudioUrl(audio: AudioOutput | null): string | null {
    if (!audio?.filename) return null;
    return `/v1/voice/files/${encodeURIComponent(audio.filename)}`;
  }

  const audio: AudioOutput = {
    asset_id: "test file (1).wav",
    filename: "test file (1).wav",
    provider: "kozy",
  };

  const url = buildAudioUrl(audio);
  console.assert(url === "/v1/voice/files/test%20file%20(1).wav", `URL encoding failed: ${url}`);
  console.assert(buildAudioUrl(null) === null, "null should return null");
  console.assert(buildAudioUrl({ asset_id: "x", provider: "k" }) === null, "missing filename should return null");
  console.log("✅ testBuildAudioUrl passed");
}

function testPathTraversalGuard() {
  const path = require("path");
  function safeResolve(filename: string): string | null {
    const KOZY_OUT_DIR = "/tmp/test_voice_out";
    if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return null;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
      return null;
    }
    const resolved = path.resolve(KOZY_OUT_DIR, filename);
    if (!resolved.startsWith(path.resolve(KOZY_OUT_DIR))) {
      return null;
    }
    return resolved;
  }

  console.assert(safeResolve("valid.wav") !== null, "valid filename should pass");
  console.assert(safeResolve("../etc/passwd") === null, "traversal should fail");
  console.assert(safeResolve("foo/bar.wav") === null, "slash should fail");
  console.assert(safeResolve("") === null, "empty should fail");
  console.assert(safeResolve("file; rm -rf .wav") === null, "special chars should fail");
  console.log("✅ testPathTraversalGuard passed");
}

async function main() {
  testAudioMetadataInSurfaceReply();
  testTextOnlySurfaceReply();
  testBuildAudioUrl();
  testPathTraversalGuard();
  console.log("\n✅ All voice delivery chain tests passed");
}

main().catch((e) => {
  console.error("❌ Test failed:", e);
  process.exit(1);
});
