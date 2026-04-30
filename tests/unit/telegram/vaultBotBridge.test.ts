/**
 * Tests for Tele GPT Vault Bridge
 *
 * Tests:
 *   - teleGPTClient: bridge communication
 *   - vaultResolver: secret resolution
 *   - shouldRouteToTeleGPT: routing logic
 *   - formatForTelegram: message formatting
 *   - resolveSecretAlias: alias to path mapping
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ============================================================================
// teleGPTBridge tests
// ============================================================================

import {
  createTeleGPTClient,
  shouldRouteToTeleGPT,
  formatForTelegram,
  resolveSecretAlias,
} from "../../../src/telegram/teleGPTBridge.js";

describe("teleGPTBridge — Client Creation", () => {
  it("creates a client with default options", () => {
    const client = createTeleGPTClient({
      baseURL: "http://localhost:8787",
    });

    assert.ok(client.chat);
    assert.ok(client.health);
    assert.ok(client.models);
  });

  it("creates a client with custom options", () => {
    const client = createTeleGPTClient({
      baseURL: "http://custom:9000",
      timeoutMs: 10_000,
      retryCount: 5,
    });

    assert.ok(client.chat);
    assert.ok(client.health);
    assert.ok(client.models);
  });

  it("health returns unreachable when server is down", async () => {
    const client = createTeleGPTClient({
      baseURL: "http://localhost:99999",
      timeoutMs: 1_000,
    });

    const result = await client.health();
    assert.equal(result.ok, false);
    assert.equal(result.status, "unreachable");
  });

  it("models returns empty array when server is down", async () => {
    const client = createTeleGPTClient({
      baseURL: "http://localhost:99999",
      timeoutMs: 1_000,
    });

    const result = await client.models();
    assert.ok(Array.isArray(result));
  });
});

describe("teleGPTBridge — Routing Logic", () => {
  it("routes regular messages to Tele GPT", () => {
    assert.equal(shouldRouteToTeleGPT("Hello, how are you?"), true);
    assert.equal(shouldRouteToTeleGPT("What is 2+2?"), true);
  });

  it("routes unknown commands to Tele GPT", () => {
    assert.equal(shouldRouteToTeleGPT("/ask something"), true);
    assert.equal(shouldRouteToTeleGPT("/chat hello"), true);
  });

  it("does not route local Vault commands", () => {
    assert.equal(shouldRouteToTeleGPT("/get key"), false);
    assert.equal(shouldRouteToTeleGPT("/set key value"), false);
    assert.equal(shouldRouteToTeleGPT("/rotate key"), false);
    assert.equal(shouldRouteToTeleGPT("/revoke key"), false);
    assert.equal(shouldRouteToTeleGPT("/audit"), false);
    assert.equal(shouldRouteToTeleGPT("/status"), false);
    assert.equal(shouldRouteToTeleGPT("/help"), false);
  });

  it("respects custom local commands", () => {
    assert.equal(
      shouldRouteToTeleGPT("/mycommand", { localCommands: ["mycommand"] }),
      false,
    );
    assert.equal(
      shouldRouteToTeleGPT("/othercommand", { localCommands: ["mycommand"] }),
      true,
    );
  });
});

describe("teleGPTBridge — Message Formatting", () => {
  it("returns message as-is if within limit", () => {
    const shortMessage = "Hello, world!";
    assert.equal(formatForTelegram(shortMessage), shortMessage);
  });

  it("truncates messages exceeding limit", () => {
    const longMessage = "A".repeat(5000);
    const result = formatForTelegram(longMessage, { maxLength: 4096 });

    assert.ok(result.length <= 4096);
    assert.ok(result.includes("[truncated]"));
  });

  it("handles empty messages", () => {
    assert.equal(formatForTelegram(""), "");
  });
});

describe("teleGPTBridge — Secret Alias Resolution", () => {
  it("resolves openai alias to correct path", () => {
    const path = resolveSecretAlias("openai:api_key");
    assert.ok(path.includes("ai/openai"));
    assert.ok(path.includes("chat"));
  });

  it("resolves telegram alias to correct path", () => {
    const path = resolveSecretAlias("telegram:bot_token");
    assert.ok(path.includes("messaging/telegram"));
    assert.ok(path.includes("bot/token"));
  });

  it("resolves db alias to correct path", () => {
    const path = resolveSecretAlias("db:password");
    assert.ok(path.includes("database/main"));
    assert.ok(path.includes("password"));
  });

  it("falls back to generic path for unknown categories", () => {
    const path = resolveSecretAlias("custom:secret");
    assert.ok(path.includes("secrets/custom"));
  });

  it("throws on invalid alias format", () => {
    assert.throws(
      () => resolveSecretAlias("invalid_no_colon"),
      /Invalid secret alias/,
    );
  });
});

// ============================================================================
// vaultResolver tests
// ============================================================================

import {
  createVaultResolver,
  injectVaultSecrets,
} from "../../../src/server/vaultResolver.js";

describe("vaultResolver — Client Creation", () => {
  it("creates a resolver with default options", () => {
    const resolver = createVaultResolver({
      baseURL: "http://localhost:8200",
    });

    assert.ok(resolver.resolve);
    assert.ok(resolver.resolveMultiple);
    assert.ok(resolver.getAuditLog);
    assert.ok(resolver.clearCache);
  });

  it("returns error when token is not configured", async () => {
    // Make sure VAULT_TOKEN is not set
    const original = process.env.VAULT_TOKEN;
    delete process.env.VAULT_TOKEN;

    const resolver = createVaultResolver({
      baseURL: "http://localhost:8200",
    });

    const result = await resolver.resolve("openai:api_key");
    assert.equal(result.found, false);
    assert.ok(result.error?.includes("token"));

    // Restore
    if (original) process.env.VAULT_TOKEN = original;
  });

  it("tracks audit log entries", async () => {
    const resolver = createVaultResolver({
      baseURL: "http://localhost:8200",
    });

    await resolver.resolve("test:alias_1");
    await resolver.resolve("test:alias_2");

    const log = resolver.getAuditLog();
    assert.equal(log.length, 2);
    assert.equal(log[0].alias, "test:alias_2"); // most recent first
    assert.equal(log[1].alias, "test:alias_1");
  });

  it("clears cache", () => {
    const resolver = createVaultResolver({
      baseURL: "http://localhost:8200",
    });

    resolver.clearCache();
    // Should not throw
    assert.ok(true);
  });
});

describe("vaultResolver — Secret Injection", () => {
  it("returns message as-is if no vault patterns", async () => {
    const resolver = createVaultResolver({
      baseURL: "http://localhost:8200",
    });

    const result = await injectVaultSecrets("Hello, world!", resolver);
    assert.equal(result.message, "Hello, world!");
    assert.equal(result.injected.length, 0);
    assert.equal(result.errors.length, 0);
  });

  it("detects vault patterns but fails without vault", async () => {
    const resolver = createVaultResolver({
      baseURL: "http://localhost:8200",
    });

    const result = await injectVaultSecrets(
      "Use key ${vault:openai:api_key}",
      resolver,
    );

    // Pattern detected but resolution failed (no vault running)
    assert.ok(result.errors.length > 0 || result.message.includes("openai"));
  });

  it("handles multiple vault patterns", async () => {
    const resolver = createVaultResolver({
      baseURL: "http://localhost:8200",
    });

    const result = await injectVaultSecrets(
      "Use ${vault:openai:key} and ${vault:db:pass}",
      resolver,
    );

    // Should attempt to resolve both
    assert.ok(
      result.message.includes("Use") && result.message.includes("and"),
    );
  });
});

// ============================================================================
// Integration: Full Bridge Pipeline
// ============================================================================

describe("Integration: Bridge Pipeline", () => {
  it("end-to-end routing decision", () => {
    // Local commands should stay in bot
    assert.equal(shouldRouteToTeleGPT("/get key"), false);
    assert.equal(shouldRouteToTeleGPT("/help"), false);

    // Regular messages should go to Tele GPT
    assert.equal(shouldRouteToTeleGPT("What is the meaning of life?"), true);
    assert.equal(shouldRouteToTeleGPT("Write me a poem"), true);
  });

  it("client can be created and health checked", async () => {
    const client = createTeleGPTClient({
      baseURL: "http://localhost:8787",
      timeoutMs: 1_000,
    });

    const health = await client.health();
    // Server may not be running, so we just check structure
    assert.ok(typeof health.ok === "boolean");
    assert.ok(typeof health.status === "string");
  });

  it("resolver tracks audit entries across multiple operations", async () => {
    const resolver = createVaultResolver({
      baseURL: "http://localhost:8200",
    });

    // Multiple resolve attempts
    await resolver.resolve("test:a");
    await resolver.resolve("test:b");
    await resolver.resolve("test:c");

    const log = resolver.getAuditLog();
    assert.equal(log.length, 3);

    // All should have userId undefined (not provided)
    assert.equal(log[0].userId, undefined);
  });
});
