import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalRegistryString,
  canonicalizeRegistry,
  loadRegistry,
  registryDigest,
  type KeyRegistry,
  type RegistryKey,
  type RegistryKeyStatus,
} from "../src/core/security/keyRegistry.js";

export type { KeyRegistry, RegistryKey, RegistryKeyStatus };
export { canonicalizeRegistry, canonicalRegistryString, registryDigest, loadRegistry };

function printRegistry(registry: KeyRegistry, digest: string, filePath: string) {
  console.log("✅ K2.12 registry loaded");
  console.log(`- path: ${filePath}`);
  console.log(`- registry_digest_sha256: ${digest}`);
  console.log(`- keys: ${registry.keys.length}`);
  for (const key of registry.keys) {
    console.log(`  - ${key.key_id} [${key.status}] alg=${key.alg}`);
  }
}

function main() {
  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const argPath = positional[0];
  const print = process.argv.includes("--print");
  const onlyDigest = process.argv.includes("--digest");
  const { registry, digest_sha256, path: filePath } = loadRegistry(argPath);

  if (onlyDigest) {
    console.log(digest_sha256);
    return;
  }
  if (print || process.argv.length <= 2) {
    printRegistry(registry, digest_sha256, filePath);
  }
}

const isEntrypoint = (() => {
  const scriptPath = process.argv[1];
  if (!scriptPath) return false;
  return path.resolve(scriptPath) === path.resolve(fileURLToPath(import.meta.url));
})();

if (isEntrypoint) {
  try {
    main();
  } catch (err: any) {
    console.error(String(err?.stack || err));
    process.exit(1);
  }
}
