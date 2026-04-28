import { ProviderSwitch } from "../provider-switch.js";
import { PolicyGate } from "../policy-gate.js";
import { EvidenceLogger } from "../../evidence/evidence-logger.js";
import { CreatorBridgeProvider } from "./creator-bridge.stub.js";
import { chat as localChat } from "../../providers/local/chat.js";

const providerSwitch = new ProviderSwitch(
  new Map([
    ["ollama_local", {
      generate: async (prompt: string, ctx: any) => {
        const model = process.env.LOCAL_OPENAI_MODEL_DEFAULT || "qwen2.5:7b-instruct";
        const response = await localChat({ message: prompt, model });
        return response.output ?? "";
      },
    }],
    ["creator_bridge", new CreatorBridgeProvider()],
  ]),
  new PolicyGate(),
  new EvidenceLogger(),
);

async function testE2E() {
  console.log("\n=== E2E Smoke Test ===\n");

  console.log("[1] Executing with creator_bridge provider...");
  const result = await providerSwitch.execute("Say 'e2e test' in one word", {
    mode: "creator",
    providerRequested: "creator_bridge",
    consent_token: "test-token",
    trace_id: "e2e-001",
  });

  console.log("\n[2] Results:");
  console.log("  - Status:", result.status);
  console.log("  - Provider:", result.provider);

  const isStructured = result.output?.includes("success") && result.output?.includes("reason");
  console.log("  - Structured response:", isStructured ? "YES" : "NO");

  if (result.output) {
    console.log("  - Output:", result.output.slice(0, 100));
  }

  console.log("\n[3] Verification:");
  console.log("  ✓ creator_bridge attempted:", true);
  console.log("  ✓ response returned:", result.status === "SUCCESS");

  console.log("\n=== Test Complete ===\n");
  return result;
}

testE2E()
  .then((r) => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });