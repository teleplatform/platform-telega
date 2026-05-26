import assert from "node:assert/strict";
import { ExecutorRouter } from "../../../src/runtime/forge-bridge/executor-router.js";
import type { SigmaForgeCapabilityRegistry } from "../../../src/runtime/forge-bridge/adapters/sigma-forge.adapter.js";

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

const mockRegistry: SigmaForgeCapabilityRegistry = {
  last_sigma_forge_manifest: null,
  last_handshake_at: 0,
  last_handshake_status: "unavailable",
  last_protocol_version: null,
  last_runtime_id: null,
  last_capabilities: [],
  setManifest: () => {},
};

console.log("\nExecutor Router:");

test("routes to sigma_forge when healthy and capable", () => {
  const registry = {
    ...mockRegistry,
    last_sigma_forge_manifest: {
      runtime_id: "sigma_forge_local",
      runtime_name: "sigma_forge",
      version: "0.1.0",
      protocol_version: "telecore-build-v1",
      health: "healthy",
      capabilities: ["analyze_repo", "list_files", "read_file"],
      supported_targets: ["local"],
      checked_at: new Date().toISOString(),
    },
  };
  const router = new ExecutorRouter({
    sigmaForgeRegistry: registry,
    kiloMcpAvailable: true,
    forgeRemoteAvailable: true,
  });
  const result = router.resolveExecutor({ target: "auto", kind: "analyze_repo" });
  assert.equal(result.target, "sigma_forge");
});

test("routes to kilo_mcp when sigma_forge unavailable", () => {
  const router = new ExecutorRouter({
    sigmaForgeRegistry: mockRegistry,
    kiloMcpAvailable: true,
    forgeRemoteAvailable: false,
  });
  const result = router.resolveExecutor({ target: "auto", kind: "read_file" });
  assert.equal(result.target, "kilo_mcp");
});

test("respects explicit target override", () => {
  const registry = {
    ...mockRegistry,
    last_sigma_forge_manifest: {
      runtime_id: "sigma_forge_local",
      runtime_name: "sigma_forge",
      version: "0.1.0",
      protocol_version: "telecore-build-v1",
      health: "healthy",
      capabilities: ["analyze_repo"],
      supported_targets: ["local"],
      checked_at: new Date().toISOString(),
    },
  };
  const router = new ExecutorRouter({
    sigmaForgeRegistry: registry,
    kiloMcpAvailable: true,
    forgeRemoteAvailable: true,
  });
  const result = router.resolveExecutor({ target: "sigma_forge", kind: "analyze_repo" });
  assert.equal(result.target, "sigma_forge");
  assert.equal(result.reason, "explicit_target:sigma_forge");
});

test("falls back when explicit target unavailable", () => {
  const router = new ExecutorRouter({
    sigmaForgeRegistry: mockRegistry,
    kiloMcpAvailable: true,
    forgeRemoteAvailable: true,
  });
  const result = router.resolveExecutor({ target: "sigma_forge", kind: "analyze_repo" });
  assert.equal(result.target, "kilo_mcp");
});

test("returns executor status", () => {
  const registry = {
    ...mockRegistry,
    last_sigma_forge_manifest: {
      runtime_id: "sigma_forge_local",
      runtime_name: "sigma_forge",
      version: "0.1.0",
      protocol_version: "telecore-build-v1",
      health: "healthy",
      capabilities: ["analyze_repo"],
      supported_targets: ["local"],
      checked_at: new Date().toISOString(),
    },
  };
  const router = new ExecutorRouter({
    sigmaForgeRegistry: registry,
    kiloMcpAvailable: true,
    forgeRemoteAvailable: true,
  });
  const status = router.getExecutorStatus();
  assert.ok(status.length >= 2);
  assert.ok(status.some((s) => s.target === "sigma_forge"));
  assert.ok(status.some((s) => s.target === "kilo_mcp"));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);