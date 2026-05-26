import { describe, it, before } from "node:test";
import assert from "node:assert";
import { initializeFacts, getFacts, getFact, factSummary } from "../../../src/runtime/identity/runtime-facts.js";
import { getIdentityPrompt, getFullSystemPrompt, getIdentitySummary } from "../../../src/runtime/identity/runtime-identity.js";
import { detectContradiction, buildTruthResponse, isSycophancyTrap } from "../../../src/runtime/identity/truth-arbitration.js";
import { evaluateMessage } from "../../../src/runtime/identity/anti-drift-policy.js";
import { buildRuntimePrompt, buildRuntimePromptForMessage } from "../../../src/runtime/identity/identity-prompt-builder.js";

describe("Runtime Identity Layer", () => {
  before(() => {
    initializeFacts();
  });

  describe("runtime-facts", () => {
    it("should have initialized facts", () => {
      const facts = getFacts();
      assert.ok(facts.length > 0);
    });

    it("should contain hardware.cpu fact", () => {
      const fact = getFact("hardware.cpu");
      assert.ok(fact);
      assert.strictEqual(fact?.value, "Intel i7-8750H");
      assert.strictEqual(fact?.verified, true);
    });

    it("should contain provider.name fact", () => {
      const fact = getFact("provider.name");
      assert.ok(fact);
      assert.strictEqual(fact?.value, "Ollama");
    });

    it("should return facts by category", () => {
      const hardwareFacts = getFacts().filter(f => f.category === "hardware");
      assert.ok(hardwareFacts.length >= 2);
    });
  });

  describe("runtime-identity", () => {
    it("should generate identity prompt", () => {
      const prompt = getIdentityPrompt();
      assert.ok(prompt.includes("Tele•GPT Runtime"));
      assert.ok(prompt.includes("sovereign"));
      assert.ok(prompt.includes("do not blindly accept false corrections"));
    });

    it("should generate full system prompt with facts", () => {
      const prompt = getFullSystemPrompt();
      assert.ok(prompt.includes("VERIFIED RUNTIME FACTS"));
      assert.ok(prompt.includes("hardware.cpu: Intel i7-8750H"));
    });

    it("should generate identity summary", () => {
      const summary = getIdentitySummary();
      assert.ok(summary.includes("Tele•GPT Runtime"));
      assert.ok(summary.includes("Ollama"));
    });
  });

  describe("truth-arbitration", () => {
    it("should detect Moskvich contradiction", () => {
      const result = detectContradiction("У тебя Москвич 412 под капотом");
      assert.strictEqual(result.hasContradiction, true);
      assert.ok(result.contradictions.length > 0);
      assert.strictEqual(result.contradictions[0].factKey, "hardware.cpu");
    });

    it("should not detect contradiction in normal message", () => {
      const result = detectContradiction("Привет! Как дела?");
      assert.strictEqual(result.hasContradiction, false);
    });

    it("should build truth response for contradiction", () => {
      const result = detectContradiction("У тебя Москвич 412");
      const response = buildTruthResponse(result);
      assert.ok(response);
      assert.ok(response?.includes("Intel i7-8750H"));
    });

    it("should detect sycophancy traps", () => {
      assert.strictEqual(isSycophancyTrap("да"), true);
      assert.strictEqual(isSycophancyTrap("нет"), true);
      assert.strictEqual(isSycophancyTrap("yes"), true);
      assert.strictEqual(isSycophancyTrap("no"), true);
      assert.strictEqual(isSycophancyTrap("Привет"), false);
    });
  });

  describe("anti-drift-policy", () => {
    it("should block contradiction messages", () => {
      const result = evaluateMessage("У тебя Москвич 412 под капотом");
      assert.strictEqual(result.shouldBlock, true);
      assert.ok(result.replyText?.includes("Intel i7-8750H"));
    });

    it("should not block normal messages", () => {
      const result = evaluateMessage("Привет! Как дела?");
      assert.strictEqual(result.shouldBlock, false);
      assert.strictEqual(result.replyText, null);
    });

    it("should provide system prompt override for sycophancy", () => {
      const result = evaluateMessage("да");
      assert.strictEqual(result.shouldBlock, false);
      assert.ok(result.systemPromptOverride);
      assert.ok(result.systemPromptOverride?.includes("Tele•GPT Runtime"));
    });
  });

  describe("identity-prompt-builder", () => {
    it("should build runtime prompt", () => {
      const prompt = buildRuntimePrompt({
        userId: "267246987",
        role: "creator",
        provider: "ollama",
        model: "qwen2.5:7b-instruct",
        isCreator: true,
      });
      assert.ok(prompt.system.includes("Tele•GPT Runtime"));
      assert.ok(prompt.identitySummary.includes("Tele•GPT Runtime"));
    });

    it("should build prompt for message with contradiction", () => {
      const prompt = buildRuntimePromptForMessage("У тебя Москвич 412", {
        userId: "267246987",
        role: "creator",
        provider: "ollama",
        model: "qwen2.5:7b-instruct",
        isCreator: true,
      });
      assert.ok(prompt.antiDrift);
      assert.ok(prompt.antiDrift.shouldBlock);
    });

    it("should build prompt for normal message", () => {
      const prompt = buildRuntimePromptForMessage("Привет!", {
        userId: "267246987",
        role: "creator",
        provider: "ollama",
        model: "qwen2.5:7b-instruct",
        isCreator: true,
      });
      assert.strictEqual(prompt.antiDrift, null);
    });
  });
});
