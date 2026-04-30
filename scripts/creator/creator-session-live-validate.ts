import { runCreatorSessionLiveValidation, type LiveValidationTarget } from "../src/providers/creator/session/live-validation.js";
import { executeWithPolicy, type ExecutionRequest } from "../src/core/provider-execution.js";
import { resolveModel } from "../src/core/provider-resolution.js";

async function main() {
  const providerArg = process.argv[2] || "openai_web";
  
  const validProviders = ["openai_web", "qwen_web", "deepseek_web"];
  if (!validProviders.includes(providerArg)) {
    console.error(`Invalid provider: ${providerArg}. Valid: ${validProviders.join(", ")}`);
    process.exit(1);
  }

  const provider = providerArg as LiveValidationTarget;
  const prompt = "Ответь ровно словом READY";

  console.log(`\n🚀 Running live validation for: ${provider}\n`);

  const report = await runCreatorSessionLiveValidation({
    provider,
    executeFn: async ({ provider, input, creatorMode, trace_id }) => {
      const resolved = resolveModel(provider);
      
      const execRequest: ExecutionRequest = {
        resolved,
        messages: [{ role: "user", content: input }],
        systemPrompt: undefined,
        context: {
          isCreatorMode: creatorMode,
          traceId: trace_id,
        },
      };

      return await executeWithPolicy(execRequest);
    },
    traceReader: async (traceId) => {
      const { getTrace } = await import("../src/core/provider-trace.js");
      return getTrace(traceId);
    },
    prompt,
  });

  console.log("\n📊 VALIDATION REPORT:");
  console.log("─".repeat(60));
  console.log(JSON.stringify(report, null, 2));
  console.log("─".repeat(60));

  if (report.ok && report.verdict === "live_validated") {
    console.log(`\n✅ LIVE VALIDATED: ${provider}`);
    console.log(`   provider_final: ${report.provider_final}`);
    console.log(`   session_state: ${report.session_state}`);
    console.log(`   fallback_used: ${report.fallback_used}`);
    process.exit(0);
  } else {
    console.log(`\n❌ VALIDATION FAILED: ${provider}`);
    console.log(`   verdict: ${report.verdict}`);
    console.log(`   errors: ${report.errors.join(", ")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n💥 FATAL ERROR:", err);
  process.exit(1);
});