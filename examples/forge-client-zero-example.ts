
// Example: ForgeClientZero - Client Zero Usage

import { ForgeClientZero } from "../src/core/agent/runtime/forgeClient.js";

async function main() {
  // Initialize client
  const client = new ForgeClientZero({
    baseUrl: "http://localhost:8787",
    auth: {
      type: "bearer",
      token: process.env.FORGE_TOKEN || "forge_ephemeral_token",
    },
  });

  console.log("🚀 Starting Client Zero Live Loop");
  console.log("================================");

  // Step 1: Run agent
  console.log("
1️⃣ Running agent...");
  const runResponse = await client.run({
    input: {
      task: "Test task for live loop",
      messages: [
        { role: "user", content: "Hello, this is a test" },
      ],
      context_refs: [
        {
          kind: "repo",
          remote: "https://github.com/org/repo",
          ref: "main",
          commit: "abc123",
        },
        {
          kind: "artifact",
          path: "/workspace/docs/README.md",
        },
      ],
    },
    options: {
      model: "openai:gpt-4o-mini",
      reply_mode: "forge",
      tools: {
        fs_read: true,
        net_fetch: false,
      },
    },
    forge: {
      workspace: {
        kind: "worktree",
        root: "/workspace",
        allow_paths: ["/workspace/docs", "/workspace/src"],
        deny_paths: ["/workspace/.git", "/workspace/node_modules"],
      },
      tool_proxy: {
        base_url: "http://forge-toolproxy:7777",
        auth: {
          type: "bearer",
          token: "forge_ephemeral_token",
        },
      },
    },
  });

  if (!runResponse.ok || !runResponse.sid) {
    console.error("❌ Run failed:", runResponse.error);
    process.exit(1);
  }

  console.log("✅ Run started");
  console.log("   SID:", runResponse.sid);
  console.log("   Status:", runResponse.status);
  console.log("   Links:", runResponse.links);
  console.log("   Evidence:", runResponse.evidence);

  // Step 2: Stream events
  console.log("
2️⃣ Streaming events...");
  console.log("------------------");

  if (!runResponse.links?.stream) {
    console.error("❌ No stream URL in response");
    process.exit(1);
  }

  await client.stream(runResponse.sid, (event) => {
    console.log(`[${event.type}] ${event.lvl}`);
    console.log(`  Actor: ${event.actor.kind}/${event.actor.id}`);
    if (event.data) {
      console.log(`  Data:`, JSON.stringify(event.data, null, 2));
    }
    console.log();
  });

  console.log("✅ Stream completed");

  // Step 3: Verify evidence
  console.log("
3️⃣ Verifying evidence...");
  console.log("------------------------");

  if (!runResponse.evidence?.bundle_ref) {
    console.error("❌ No bundle_ref in response");
    process.exit(1);
  }

  const verifyResponse = await client.verify({
    bundle_ref: runResponse.evidence.bundle_ref,
  });

  if (!verifyResponse.ok) {
    console.error("❌ Verify failed:", verifyResponse.error);
    process.exit(1);
  }

  console.log("✅ Verify completed");
  console.log("   Verified:", verifyResponse.verified);
  console.log("   Bundle hash:", verifyResponse.bundle_hash);
  console.log("   Checks:", verifyResponse.checks);

  if (verifyResponse.violations && verifyResponse.violations.length > 0) {
    console.log("   Violations:");
    verifyResponse.violations.forEach((v) => console.log(`     - ${v}`));
  }

  console.log("
🎉 Live loop completed successfully!");
  console.log("================================");
  console.log("✓ Run → Stream → Evidence → Verify");
  console.log("✓ Client Zero is ready");
}

// Run example
main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
