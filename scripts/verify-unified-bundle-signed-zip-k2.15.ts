import { createHash, createPublicKey, verify } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadRegistry } from "./telecore-key-registry.k2.12";

type ZipEntry = {
  name: string;
  method: number;
  flags: number;
  content: Buffer;
};

function sha256Hex(buf: Buffer | string) {
  return createHash("sha256").update(buf).digest("hex");
}

function fail(msg: string): never {
  throw new Error(`[K2.15] ${msg}`);
}

function parseZipStoreEntries(zipBuffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (offset + 30 <= zipBuffer.length) {
    const sig = zipBuffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const flags = zipBuffer.readUInt16LE(offset + 6);
    const method = zipBuffer.readUInt16LE(offset + 8);
    const compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const nameLen = zipBuffer.readUInt16LE(offset + 26);
    const extraLen = zipBuffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > zipBuffer.length) fail("ZIP corrupted: filename out of bounds");
    const dataStart = nameEnd + extraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > zipBuffer.length) fail("ZIP corrupted: data out of bounds");
    const name = zipBuffer.subarray(nameStart, nameEnd).toString("utf8");
    const content = zipBuffer.subarray(dataStart, dataEnd);
    entries.push({ name, method, flags, content });
    offset = dataEnd;
  }
  return entries;
}

function getEntry(entries: ZipEntry[], name: string): ZipEntry {
  const item = entries.find((e) => e.name === name);
  if (!item) fail(`${name} missing`);
  return item;
}

function assertLayout(names: string[]) {
  if (!names.includes("manifest.json")) fail("manifest.json missing");
  if (!names.includes("bundle.sha256")) fail("bundle.sha256 missing");
  if (!names.includes("bundle.pub.json")) fail("bundle.pub.json missing");
  if (!names.includes("bundle.sig.json")) fail("bundle.sig.json missing");
  if (!names.includes("bundle.registry.json")) fail("bundle.registry.json missing");
  if (!names.includes("bundle.policy.json")) fail("bundle.policy.json missing");
  for (const name of names) {
    if (
      name === "manifest.json" ||
      name === "bundle.sha256" ||
      name === "bundle.sig" ||
      name === "bundle.pub.json" ||
      name === "bundle.sig.json" ||
      name === "bundle.sig.v3.json" ||
      name === "bundle.registry.json" ||
      name === "bundle.policy.json"
    ) continue;
    if (name.startsWith("receipts/") && name.endsWith(".json")) continue;
    if (name.startsWith("disputes/") && name.endsWith(".json")) continue;
    fail(`Unexpected path in ZIP: ${name}`);
  }
}

function computeCanonicalBundleDigest(entries: ZipEntry[]): string {
  const index = entries
    .filter((e) => !["bundle.sha256", "bundle.sig", "bundle.pub.json", "bundle.sig.json", "bundle.sig.v3.json", "bundle.registry.json", "bundle.policy.json"].includes(e.name))
    .map((e) => ({
      path: e.name,
      digest_sha256: sha256Hex(e.content),
      size_bytes: e.content.length,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return sha256Hex(JSON.stringify(index));
}

function parseExportedAt(entries: ZipEntry[]): string {
  const manifest = JSON.parse(getEntry(entries, "manifest.json").content.toString("utf8"));
  const exportedAt = manifest?.exported_at;
  if (typeof exportedAt !== "string" || Number.isNaN(Date.parse(exportedAt))) {
    fail("manifest exported_at missing or invalid");
  }
  return exportedAt;
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node --import tsx scripts/verify-unified-bundle-signed-zip-k2.15.ts <path/to/unified-export-bundle.signed.zip>");
    process.exit(2);
  }
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    console.error(`[K2.15] File not found: ${abs}`);
    process.exit(2);
  }

  const zip = fs.readFileSync(abs);
  const entries = parseZipStoreEntries(zip);
  if (!entries.length) fail("No ZIP entries parsed");
  for (const e of entries) {
    if (e.method !== 0) fail(`ZIP entry not STORE for ${e.name}`);
    if (e.flags !== 0) fail(`ZIP entry flags must be 0 for ${e.name}`);
  }
  const names = entries.map((e) => e.name);
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(names) !== JSON.stringify(sorted)) fail("ZIP entry order is not lexicographic deterministic");
  assertLayout(names);

  const bundleSha = getEntry(entries, "bundle.sha256").content.toString("utf8");
  if (!/^[a-f0-9]{64}\n$/.test(bundleSha)) fail("bundle.sha256 format invalid");
  const declaredDigest = bundleSha.slice(0, 64);
  const computedDigest = computeCanonicalBundleDigest(entries);
  if (declaredDigest !== computedDigest) {
    fail(`Bundle digest mismatch: declared=${declaredDigest}, computed=${computedDigest}`);
  }

  const bundlePub = JSON.parse(getEntry(entries, "bundle.pub.json").content.toString("utf8"));
  const sigJson = JSON.parse(getEntry(entries, "bundle.sig.json").content.toString("utf8"));
  const registryPin = JSON.parse(getEntry(entries, "bundle.registry.json").content.toString("utf8"));
  if (bundlePub?.alg !== "ed25519" || typeof bundlePub?.key_id !== "string" || typeof bundlePub?.public_key_b64 !== "string") {
    fail("bundle.pub.json invalid");
  }
  if (
    sigJson?.kind !== "telecore_bundle_signature" ||
    sigJson?.version !== "v1" ||
    sigJson?.alg !== "ed25519" ||
    sigJson?.message_v !== "v2" ||
    typeof sigJson?.key_id !== "string" ||
    typeof sigJson?.message_sha256 !== "string" ||
    typeof sigJson?.signature_b64 !== "string"
  ) {
    fail("bundle.sig.json invalid");
  }
  if (registryPin?.kind !== "telecore_trust_registry_digest" || registryPin?.version !== "v1") {
    fail("bundle.registry.json kind/version invalid");
  }
  if (bundlePub.key_id !== sigJson.key_id) {
    fail("key_id mismatch between bundle.pub.json and bundle.sig.json");
  }

  const { registry, digest_sha256: registryDigest } = loadRegistry(process.env.TELECORE_KEY_REGISTRY_PATH);
  if (registryPin.registry_digest_sha256 !== registryDigest) {
    fail("bundle.registry.json digest does not match local trust registry");
  }
  if (registryPin.registry_version !== registry.registry_version) {
    fail("bundle.registry.json registry_version mismatch");
  }
  if (registryPin.registry_updated_at !== registry.updated_at) {
    fail("bundle.registry.json registry_updated_at mismatch");
  }

  const trustKey = registry.keys.find((k) => k.key_id === sigJson.key_id);
  if (!trustKey) fail(`key_id not found in registry: ${sigJson.key_id}`);
  if (registry.policy.require_key_id_match && trustKey.key_id !== sigJson.key_id) {
    fail("key_id mismatch");
  }
  if (!registry.policy.accept_if_key_status.includes(trustKey.status)) {
    fail(`key status not allowed by policy: ${trustKey.status}`);
  }
  if (trustKey.public_key_spki_b64 !== bundlePub.public_key_b64 && !registry.policy.allow_embedded_pubkey_fallback) {
    fail("embedded pubkey mismatch with trusted registry key");
  }

  const exportedAt = parseExportedAt(entries);
  if (trustKey.revoked_at) {
    if (registry.policy.allow_signatures_before_revoke_at) {
      if (new Date(exportedAt).getTime() >= new Date(trustKey.revoked_at).getTime()) {
        fail(`key revoked for this signature time: ${trustKey.revoked_at}`);
      }
    } else {
      fail(`key revoked: ${trustKey.revoked_at}`);
    }
  }

  const messageV2 = `${declaredDigest}\n${registryPin.registry_digest_sha256}\n${sigJson.key_id}\n`;
  const messageV2Sha256 = sha256Hex(Buffer.from(messageV2, "utf8"));
  if (sigJson.message_sha256 !== messageV2Sha256) {
    fail("bundle.sig.json message_sha256 mismatch");
  }

  const publicKey = createPublicKey({
    key: Buffer.from(trustKey.public_key_spki_b64, "base64"),
    format: "der",
    type: "spki",
  });
  const ok = verify(
    null,
    Buffer.from(messageV2, "utf8"),
    publicKey,
    Buffer.from(sigJson.signature_b64, "base64")
  );
  if (!ok) fail("signature verification failed");

  console.log("✅ K2.15 Signed ZIP verified with bound trust payload (offline)");
  console.log(`- bundle_digest_sha256: ${declaredDigest}`);
  console.log(`- registry_digest_sha256: ${registryDigest}`);
  console.log(`- key_id: ${sigJson.key_id}`);
  console.log(`- key_status: ${trustKey.status}`);
}

try {
  main();
  process.exit(0);
} catch (err: any) {
  console.error(String(err?.stack || err));
  process.exit(1);
}
