import { CreatorBridgeProvider } from "./creator-bridge.stub.js";

async function testCreatorBridgeProvider() {
  const provider = new CreatorBridgeProvider();

  console.log("[test] Testing CreatorBridgeProvider with bridge_model: openai");

  try {
    const result = await provider.generate(
      "Say 'hello test' in one word",
      { bridge_model: "openai", trace_id: "test-001" }
    );

    console.log("[test] Response:", result);
    console.log("[test] ✓ Success - no errors");
    return true;
  } catch (error: any) {
    if (error?.message?.includes("OPENAI_API_KEY not configured")) {
      console.log("[test] ✗ Skipped - OPENAI_API_KEY not set");
      return null;
    }
    if (error?.message?.includes("ByteString") || error?.message?.includes("convert")) {
      console.log("[test] ✗ Skipped - OPENAI_API_KEY invalid (contains non-ASCII)");
      return null;
    }
    console.error("[test] ✗ Error:", error?.message);
    return false;
  }
}

testCreatorBridgeProvider()
  .then((result) => {
    process.exit(result === false ? 1 : 0);
  })
  .catch((err) => {
    console.error("[test] Fatal:", err);
    process.exit(1);
  });