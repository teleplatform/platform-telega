import { createApiKey, revokeApiKey, listApiKeys } from "./store.js";

const args = process.argv.slice(2);
const command = args[0];

function printUsage() {
  console.log(`
TeleGPT API Key Manager

Usage:
  npx tsx src/api-keys/cli.ts create --name <name> --models <model1,model2> [--tools] [--streaming]
  npx tsx src/api-keys/cli.ts list
  npx tsx src/api-keys/cli.ts revoke --id <key_id>
`);
}

function parseFlags(args: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

switch (command) {
  case "create": {
    const flags = parseFlags(args.slice(1));
    const name = (flags.name as string) || "opencode-gpt";
    const modelsStr = (flags.models as string) || "kimi-k3,kimi-k2.7-code";
    const models = modelsStr.split(",").map((m) => m.trim());
    const tools = flags.tools !== false;
    const streaming = flags.streaming !== false;

    const result = createApiKey({
      name,
      clientType: "opencode",
      allowedModels: models,
      permissions: { chat: true, tools, streaming },
    });

    console.log("\n  Key created successfully!\n");
    console.log(`  Name:    ${name}`);
    console.log(`  Models:  ${models.join(", ")}`);
    console.log(`  Tools:   ${tools}`);
    console.log(`  Stream:  ${streaming}`);
    console.log(`  ID:      ${result.key.id}`);
    console.log(`  Prefix:  ${result.key.prefix}...`);
    console.log(`\n  Full key (save it — shown only once):\n`);
    console.log(`  ${result.fullKey}\n`);
    break;
  }

  case "list": {
    const keys = listApiKeys();
    if (keys.length === 0) {
      console.log("\n  No API keys found.\n");
    } else {
      console.log(`\n  ${keys.length} API key(s):\n`);
      for (const k of keys) {
        console.log(`  ID:     ${k.id}`);
        console.log(`  Name:   ${k.name}`);
        console.log(`  Prefix: ${k.prefix}...`);
        console.log(`  Status: ${k.status}`);
        console.log(`  Models: ${k.allowedModels.join(", ")}`);
        console.log(`  Created: ${k.createdAt}`);
        if (k.lastUsedAt) console.log(`  Last used: ${k.lastUsedAt}`);
        console.log("");
      }
    }
    break;
  }

  case "revoke": {
    const flags = parseFlags(args.slice(1));
    const id = flags.id as string;
    if (!id) {
      console.error("  Error: --id is required");
      process.exit(1);
    }
    const ok = revokeApiKey(id);
    if (ok) {
      console.log(`\n  Key ${id} revoked.\n`);
    } else {
      console.error(`\n  Key ${id} not found.\n`);
      process.exit(1);
    }
    break;
  }

  default:
    printUsage();
    process.exit(1);
}
