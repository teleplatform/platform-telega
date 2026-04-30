import { createHash, createPublicKey, verify } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

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
  throw new Error(`[K2.11] ${msg}`);
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

function assertSortedLex(names: string[]) {
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(names) !== JSON.stringify(sorted)) {
    fail("ZIP entry order is not lexicographic deterministic");
  }
}

function assertLayout(names: string[]) {
  if (!names.includes("manifest.json")) fail("manifest.json missing");
  if (!names.includes("bundle.sha256")) fail("bundle.sha256 missing");
  if (!names.includes("bundle.sig")) fail("bundle.sig missing");
  if (!names.includes("bundle.sig.json")) fail("bundle.sig.json missing");
  if (!names.includes("bundle.sig.v3.json")) fail("bundle.sig.v3.json missing");
  if (!names.includes("bundle.pub.json")) fail("bundle.pub.json missing");
  if (!names.includes("bundle.registry.json")) fail("bundle.registry.json missing");
  if (!names.includes("bundle.policy.json")) fail("bundle.policy.json missing");

  for (const n of names) {
    if (
      n === "manifest.json" ||
      n === "bundle.sha256" ||
      n === "bundle.sig" ||
      n === "bundle.sig.json" ||
      n === "bundle.sig.v3.json" ||
      n === "bundle.pub.json" ||
      n === "bundle.registry.json" ||
      n === "bundle.policy.json"
    ) continue;
    if (n.startsWith("receipts/") && n.endsWith(".json")) continue;
    if (n.startsWith("disputes/") && n.endsWith(".json")) continue;
    fail(`Unexpected path in ZIP (layout violation): ${n}`);
  }
}

function getEntry(entries: ZipEntry[], name: string): ZipEntry {
  const entry = entries.find((item) => item.name === name);
  if (!entry) fail(`${name} missing`);
  return entry;
}

function computeCanonicalBundleDigest(entries: ZipEntry[]): string {
  const index = entries
    .filter((e) => e.name !== "bundle.sha256" && e.name !== "bundle.sig" && e.name !== "bundle.pub.json" && e.name !== "bundle.registry.json")
    .filter((e) => e.name !== "bundle.sig.json")
    .filter((e) => e.name !== "bundle.sig.v3.json")
    .filter((e) => e.name !== "bundle.policy.json")
    .map((e) => ({
      path: e.name,
      digest_sha256: sha256Hex(e.content),
      size_bytes: e.content.length,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return sha256Hex(JSON.stringify(index));
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node --import tsx scripts/verify-unified-bundle-signed-zip-k2.11.ts <path/to/unified-export-bundle.signed.zip>");
    process.exit(2);
  }

  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) fail(`File not found: ${abs}`);

  const zip = fs.readFileSync(abs);
  if (zip.length < 64) fail("ZIP file too small / invalid");

  const entries = parseZipStoreEntries(zip);
  if (!entries.length) fail("No ZIP entries parsed");
  for (const entry of entries) {
    if (entry.method !== 0) fail(`ZIP entry not STORE for ${entry.name}`);
    if (entry.flags !== 0) fail(`ZIP entry flags must be 0 for ${entry.name}`);
  }

  const names = entries.map((e) => e.name);
  assertSortedLex(names);
  assertLayout(names);

  const bundleSha = getEntry(entries, "bundle.sha256").content.toString("utf8");
  if (!/^[a-f0-9]{64}\n$/.test(bundleSha)) {
    fail("bundle.sha256 has invalid format");
  }
  const declaredDigest = bundleSha.slice(0, 64);
  const computedDigest = computeCanonicalBundleDigest(entries);
  if (declaredDigest !== computedDigest) {
    fail(`Bundle digest mismatch: declared=${declaredDigest}, computed=${computedDigest}`);
  }

  const pubJson = JSON.parse(getEntry(entries, "bundle.pub.json").content.toString("utf8"));
  if (pubJson?.alg !== "ed25519" || typeof pubJson?.public_key_b64 !== "string") {
    fail("bundle.pub.json invalid");
  }

  const sigText = getEntry(entries, "bundle.sig").content.toString("utf8");
  if (!sigText.endsWith("\n")) fail("bundle.sig must end with newline");
  const signatureB64 = sigText.trim();
  if (!signatureB64) fail("bundle.sig is empty");

  const publicKey = createPublicKey({
    key: Buffer.from(pubJson.public_key_b64, "base64"),
    format: "der",
    type: "spki",
  });
  const ok = verify(
    null,
    Buffer.from(`${declaredDigest}\n`, "utf8"),
    publicKey,
    Buffer.from(signatureB64, "base64")
  );
  if (!ok) {
    fail("Signature verification failed");
  }

  console.log("✅ K2.11 Signed ZIP verified (offline)");
  console.log(`- entries: ${entries.length}`);
  console.log(`- bundle_digest_sha256: ${declaredDigest}`);
  console.log(`- key_id: ${pubJson.key_id}`);
  console.log("- signature: OK (ed25519)");
}

try {
  main();
  process.exit(0);
} catch (err: any) {
  console.error(String(err?.stack || err));
  process.exit(1);
}
