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
        const response = await localChat({
          message: prompt,
          model,
        });
        return response.output ?? "";
      },
    }],
    ["creator_bridge", new CreatorBridgeProvider()],
  ]),
  new PolicyGate(),
  new EvidenceLogger(),
);

async function testFallback() {
  console.log("[test] Testing provider fallback: creator_bridge -> ollama_local");

  const result = await providerSwitch.execute("Say 'fallback test ok' in one word", {
    mode: "creator",
    providerRequested: "creator_bridge",
    consent_token: "test-token",
    trace_id: "fallback-test-001",
  });

  console.log("[test] Result:", JSON.stringify(result));
  return result;
}

testFallback()
  .then((result) => {
    if (result.status === "SUCCESS") {
      console.log("[test] ✓ Fallback worked, provider used:", result.provider);
      console.log("[test] Output:", result.output?.slice(0, 50));
    } else {
      console.log("[test] ✗ Fallback failed:", result.error);
    }
    process.exit(result.status === "SUCCESS" ? 0 : 1);
  })
  .catch((err) => {
    console.error("[test] Fatal:", err);
    process.exit(1);
  });