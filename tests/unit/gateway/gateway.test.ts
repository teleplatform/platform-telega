import assert from "node:assert/strict";
import { createApiKey, validateApiKey, revokeApiKey, listApiKeys, isModelAllowed, generateApiKey } from "../../../src/api-keys/store.js";
import { isIdeReady, listIdeModels, getIdeCompatibility, markIdeVerified } from "../../../src/gateway/ide-compatibility.js";
import { toOpenAiResponse, toOpenAiModelList, toOpenAiError } from "../../../src/gateway/adapters/openai-response.js";
import { openAiToChatRequest } from "../../../src/gateway/adapters/messages.js";
import type { ChatResponse } from "../../../src/types/chat.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

console.log("\nAPI Key System:");

test("generateApiKey returns valid format", () => {
  const { fullKey, prefix, secretHash } = generateApiKey();
  assert.ok(fullKey.startsWith("tgpt_sk_"));
  assert.ok(fullKey.length > 20);
  assert.ok(prefix.startsWith("tgpt_sk_"));
  assert.ok(secretHash.length === 64);
});

test("createApiKey stores and returns key", () => {
  const { fullKey, key } = createApiKey({
    name: "test-key",
    allowedModels: ["kimi-k3"],
  });
  assert.ok(fullKey.startsWith("tgpt_sk_"));
  assert.equal(key.name, "test-key");
  assert.deepEqual(key.allowedModels, ["kimi-k3"]);
  assert.equal(key.status, "active");
});

test("validateApiKey accepts valid key", () => {
  const { fullKey } = createApiKey({
    name: "validate-test",
    allowedModels: ["kimi-k3"],
  });
  const result = validateApiKey(fullKey);
  assert.equal(result.valid, true);
  assert.ok(result.key);
  assert.equal(result.key.name, "validate-test");
});

test("validateApiKey rejects invalid key", () => {
  const result = validateApiKey("tgpt_sk_invalidkey123");
  assert.equal(result.valid, false);
});

test("validateApiKey rejects non-tgpt key", () => {
  const result = validateApiKey("sk-something-else");
  assert.equal(result.valid, false);
});

test("revokeApiKey works", () => {
  const { key } = createApiKey({
    name: "revoke-test",
    allowedModels: ["kimi-k3"],
  });
  const ok = revokeApiKey(key.id);
  assert.equal(ok, true);
  const keys = listApiKeys();
  const revoked = keys.find((k) => k.id === key.id);
  assert.equal(revoked?.status, "revoked");
});

test("isModelAllowed checks model list", () => {
  const { key } = createApiKey({
    name: "model-test",
    allowedModels: ["kimi-k3", "kimi-k2.7-code"],
  });
  assert.equal(isModelAllowed(key, "kimi-k3"), true);
  assert.equal(isModelAllowed(key, "kimi-k2.7-code"), true);
  assert.equal(isModelAllowed(key, "gpt-4"), false);
});

test("isModelAllowed with wildcard", () => {
  const { key } = createApiKey({
    name: "wildcard-test",
    allowedModels: ["*"],
  });
  assert.equal(isModelAllowed(key, "anything"), true);
});

console.log("\nIDE Compatibility Registry:");

test("getIdeCompatibility returns kimi-k3 entry", () => {
  const entry = getIdeCompatibility("kimi-k3");
  assert.ok(entry);
  assert.equal(entry.chatCapable, true);
  assert.equal(entry.streamingCapable, true);
});

test("isIdeReady returns false for unverified model", () => {
  assert.equal(isIdeReady("kimi-k3"), false);
});

test("isIdeReady returns true with experimental flag", () => {
  assert.equal(isIdeReady("kimi-k3", true), true);
});

test("markIdeVerified updates entry", () => {
  markIdeVerified("kimi-k3");
  assert.equal(isIdeReady("kimi-k3"), true);
  const entry = getIdeCompatibility("kimi-k3");
  assert.equal(entry?.ideVerified, true);
  assert.ok(entry?.verifiedAt);
  markIdeVerified("kimi-k3");
  markIdeVerified("kimi-k3");
});

test("listIdeModels with experimental returns chat-capable models", () => {
  const models = listIdeModels(true);
  assert.ok(models.length >= 2);
  assert.ok(models.some((m) => m.modelId === "kimi-k3"));
});

console.log("\nOpenAI Response Adapter:");

test("toOpenAiResponse formats chat response", () => {
  const chatResp: ChatResponse = {
    id: "test-123",
    model: "kimi-k3",
    output: "Hello world",
  };
  const result = toOpenAiResponse(chatResp, "kimi-k3");
  assert.equal(result.id, "test-123");
  assert.equal(result.object, "chat.completion");
  assert.equal(result.choices[0].message.content, "Hello world");
  assert.equal(result.choices[0].message.role, "assistant");
  assert.equal(result.choices[0].finish_reason, "stop");
});

test("toOpenAiResponse formats usage", () => {
  const chatResp: ChatResponse = {
    id: "test-456",
    model: "kimi-k3",
    output: "Hi",
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  };
  const result = toOpenAiResponse(chatResp, "kimi-k3");
  assert.ok(result.usage);
  assert.equal(result.usage!.prompt_tokens, 10);
  assert.equal(result.usage!.completion_tokens, 5);
  assert.equal(result.usage!.total_tokens, 15);
});

test("toOpenAiModelList formats model list", () => {
  const result = toOpenAiModelList([
    { id: "kimi-k3", owned_by: "telegpt" },
    { id: "kimi-k2.7-code" },
  ]);
  assert.equal(result.object, "list");
  assert.equal(result.data.length, 2);
  assert.equal(result.data[0].id, "kimi-k3");
  assert.equal(result.data[0].owned_by, "telegpt");
  assert.equal(result.data[1].owned_by, "telegpt");
});

test("toOpenAiError formats error", () => {
  const result = toOpenAiError(401, "Unauthorized");
  assert.equal(result.error.message, "Unauthorized");
  assert.equal(result.error.type, "invalid_request_error");
});

console.log("\nMessage Adapter:");

test("openAiToChatRequest converts messages", () => {
  const result = openAiToChatRequest(
    {
      model: "kimi-k3",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
      ],
    },
    "req-123"
  );
  assert.equal(result.system, "You are helpful.");
  assert.equal(result.message, "Hello");
  assert.equal(result.model, "kimi-k3");
  assert.equal(result.request_id, "req-123");
});

test("openAiToChatRequest handles user-only messages", () => {
  const result = openAiToChatRequest(
    {
      model: "kimi-k3",
      messages: [{ role: "user", content: "Hi there" }],
    },
    "req-456"
  );
  assert.equal(result.message, "Hi there");
  assert.equal(result.system, undefined);
});

test("openAiToChatRequest preserves tools", () => {
  const tools = [{ type: "function", function: { name: "read_file" } }];
  const result = openAiToChatRequest(
    {
      model: "kimi-k3",
      messages: [{ role: "user", content: "Read file" }],
      tools,
    },
    "req-789"
  );
  assert.ok(result.tools);
  assert.equal(result.tools!.length, 1);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
