import { createHash } from "node:crypto";
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
  throw new Error(`[K2.10] ${msg}`);
}

/**
 * Minimal deterministic ZIP parser for K2.9 constraints:
 * - reads only Local File Headers (0x04034b50)
 * - requires STORE method (0) and flags=0
 * - ignores Central Directory (we don't need it for our invariants)
 */
function parseZipStoreEntries(zipBuffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 30 <= zipBuffer.length) {
    const sig = zipBuffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) break; // end of local headers area (central dir begins)

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

function assertNoDuplicates(names: string[]) {
  const seen = new Set<string>();
  for (const n of names) {
    if (seen.has(n)) fail(`Duplicate ZIP entry: ${n}`);
    seen.add(n);
  }
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

  for (const n of names) {
    if (n === "manifest.json" || n === "bundle.sha256") continue;
    if (n.startsWith("receipts/") && n.endsWith(".json")) continue;
    if (n.startsWith("disputes/") && n.endsWith(".json")) continue;
    fail(`Unexpected path in ZIP (layout violation): ${n}`);
  }
}

function extractBundleDigestFromBundleSha256(entries: ZipEntry[]): string {
  const bundle = entries.find((e) => e.name === "bundle.sha256");
  if (!bundle) fail("bundle.sha256 missing");
  const text = bundle.content.toString("utf8");

  // Strict canonical format: "<64-hex>\n"
  if (!/^[a-f0-9]{64}\n$/.test(text)) {
    fail(`bundle.sha256 has invalid format (expected 64 hex + newline). Got: ${JSON.stringify(text)}`);
  }
  return text.slice(0, 64);
}

/**
 * Canonical bundle digest (K2.8):
 * sha256(JSON.stringify([{path,digest_sha256,size_bytes}, ...] sorted by path))
 * IMPORTANT: bundle.sha256 is NOT part of canonical digest list.
 */
function computeCanonicalBundleDigest(entries: ZipEntry[]): {
  bundleDigest: string;
  index: Array<{ path: string; digest_sha256: string; size_bytes: number }>;
  perFileDigest: Map<string, string>;
} {
  const perFileDigest = new Map<string, string>();

  const index = entries
    .filter((e) => e.name !== "bundle.sha256")
    .map((e) => {
      const d = sha256Hex(e.content);
      perFileDigest.set(e.name, d);
      return { path: e.name, digest_sha256: d, size_bytes: e.content.length };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const canonical = JSON.stringify(index);
  const bundleDigest = sha256Hex(canonical);

  return { bundleDigest, index, perFileDigest };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node --import tsx scripts/verify-unified-bundle-zip-k2.10.ts <path/to/unified-export-bundle.zip>");
    process.exit(2);
  }

  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) fail(`File not found: ${abs}`);

  const zip = fs.readFileSync(abs);
  if (zip.length < 64) fail("ZIP file too small / invalid");

  const entries = parseZipStoreEntries(zip);
  if (!entries.length) fail("No ZIP entries parsed (not a K2.9 STORE ZIP?)");

  // K2.9 deterministic ZIP constraints
  for (const e of entries) {
    if (e.method !== 0) fail(`ZIP entry not STORE (method=${e.method}) for ${e.name}`);
    if (e.flags !== 0) fail(`ZIP entry flags must be 0 (flags=${e.flags}) for ${e.name}`);
  }

  const names = entries.map((e) => e.name);
  assertNoDuplicates(names);
  assertSortedLex(names);
  assertLayout(names);

  // bundle.sha256 must be consistent with canonical digest
  const declaredBundleDigest = extractBundleDigestFromBundleSha256(entries);
  const { bundleDigest, index } = computeCanonicalBundleDigest(entries);

  if (declaredBundleDigest !== bundleDigest) {
    fail(
      `Bundle digest mismatch.\n- bundle.sha256: ${declaredBundleDigest}\n- computed:     ${bundleDigest}`
    );
  }

  const bundleShaEntry = entries.find((e) => e.name === "bundle.sha256")!;
  const bundleSha256Digest = sha256Hex(bundleShaEntry.content);

  console.log("✅ K2.10 ZIP verified (offline)");
  console.log(`- entries: ${entries.length}`);
  console.log(`- bundle_digest_sha256: ${bundleDigest}`);
  console.log(`- bundle.sha256 sha256: ${bundleSha256Digest}`);
  console.log("- layout: OK (manifest.json + receipts/* + disputes/* + bundle.sha256)");
  console.log("- order: OK (lexicographic)");
  console.log("- method/flags: OK (STORE, flags=0)");
  console.log(`- canonical index files (excluding bundle.sha256): ${index.length}`);
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exit(1);
});
