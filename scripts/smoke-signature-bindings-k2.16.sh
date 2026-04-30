#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Signature Bindings v3 (K2.16)"
echo "==========================================="

tmp_zip="$(mktemp -t telega_k216_ok_XXXXXX).zip"
tmp_bad_manifest="$(mktemp -t telega_k216_bad_manifest_XXXXXX).zip"
tmp_bad_sigv3="$(mktemp -t telega_k216_bad_sigv3_XXXXXX).zip"
tmp_bad_keyid="$(mktemp -t telega_k216_bad_keyid_XXXXXX).zip"
tmp_registry_mismatch="$(mktemp -t telega_k216_registry_mismatch_XXXXXX).json"
trap 'rm -f "$tmp_zip" "$tmp_bad_manifest" "$tmp_bad_sigv3" "$tmp_bad_keyid" "$tmp_registry_mismatch"' EXIT

TELEGA_TMP_ZIP="$tmp_zip" \
TELEGA_TMP_BAD_MANIFEST="$tmp_bad_manifest" \
TELEGA_TMP_BAD_SIGV3="$tmp_bad_sigv3" \
TELEGA_TMP_BAD_KEYID="$tmp_bad_keyid" \
node --import tsx --input-type=module <<'EOF'
import fs from "node:fs";
import { pathToFileURL } from "node:url";

function parseZipEntriesWithOffsets(zipBuffer) {
  const entries = [];
  let offset = 0;
  while (offset + 30 <= zipBuffer.length) {
    const sig = zipBuffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const nameLen = zipBuffer.readUInt16LE(offset + 26);
    const extraLen = zipBuffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLen;
    const dataStart = nameEnd + extraLen;
    const dataEnd = dataStart + compressedSize;
    const name = zipBuffer.subarray(nameStart, nameEnd).toString("utf8");
    entries.push({ name, dataStart, dataEnd });
    offset = dataEnd;
  }
  return entries;
}

const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);
const subject = "demo_user";
const receipts = userBillingService.getReceipts(subject);
if (!receipts.length) throw new Error("Expected receipts for K2.16 smoke");
const dispute = userBillingService.createDispute(subject, receipts[0].receipt_id, "K2.16 smoke");
userBillingService.simulateDisputeStatus(subject, dispute.dispute_id, "reviewing", "maker");

const payload = userBillingService.getUnifiedExportSignedZipBundle(subject, {
  receiptIds: [receipts[0].receipt_id],
  disputeIds: [dispute.dispute_id],
  exportedAt: "2026-02-26T00:00:00.000Z",
});

const out = process.env.TELEGA_TMP_ZIP;
const badManifest = process.env.TELEGA_TMP_BAD_MANIFEST;
const badSigV3 = process.env.TELEGA_TMP_BAD_SIGV3;
const badKeyId = process.env.TELEGA_TMP_BAD_KEYID;
if (!out || !badManifest || !badSigV3 || !badKeyId) throw new Error("temp paths missing");
fs.writeFileSync(out, payload.zip);

const entries = parseZipEntriesWithOffsets(payload.zip);

const manifestEntry = entries.find((e) => e.name === "manifest.json");
if (!manifestEntry) throw new Error("manifest.json missing");
const manifestText = payload.zip.subarray(manifestEntry.dataStart, manifestEntry.dataEnd).toString("utf8");
const manifestReplaced = manifestText.replace("2026-02-26T00:00:00.000Z", "2026-02-27T00:00:00.000Z");
if (manifestReplaced.length !== manifestText.length) throw new Error("manifest replacement changed length");
const badManifestBuf = Buffer.from(payload.zip);
badManifestBuf.write(manifestReplaced, manifestEntry.dataStart, "utf8");
fs.writeFileSync(badManifest, badManifestBuf);

const sigV3Entry = entries.find((e) => e.name === "bundle.sig.v3.json");
if (!sigV3Entry) throw new Error("bundle.sig.v3.json missing");
const badSigV3Buf = Buffer.from(payload.zip);
badSigV3Buf[sigV3Entry.dataStart] = badSigV3Buf[sigV3Entry.dataStart] === 0x7b ? 0x7a : 0x7b;
fs.writeFileSync(badSigV3, badSigV3Buf);

const sigV3Text = payload.zip.subarray(sigV3Entry.dataStart, sigV3Entry.dataEnd).toString("utf8");
const sigV3Replaced = sigV3Text.replace("telecore_dev_2026q1", "telecore_dev_2026q2");
if (sigV3Replaced.length !== sigV3Text.length) throw new Error("sig v3 key_id replacement changed length");
if (sigV3Replaced === sigV3Text) throw new Error("sig v3 key_id replacement did not apply");
const badKeyIdBuf = Buffer.from(payload.zip);
badKeyIdBuf.write(sigV3Replaced, sigV3Entry.dataStart, "utf8");
fs.writeFileSync(badKeyId, badKeyIdBuf);
EOF

node --import tsx scripts/verify-unified-bundle-signed-zip-k2.16.ts "$tmp_zip"

if node --import tsx scripts/verify-unified-bundle-signed-zip-k2.16.ts "$tmp_bad_manifest"; then
  echo "Expected manifest exported_at tamper to fail but verify passed"
  exit 1
fi

if node --import tsx scripts/verify-unified-bundle-signed-zip-k2.16.ts "$tmp_bad_sigv3"; then
  echo "Expected bundle.sig.v3.json tamper to fail but verify passed"
  exit 1
fi

if node --import tsx scripts/verify-unified-bundle-signed-zip-k2.16.ts "$tmp_bad_keyid"; then
  echo "Expected key_id tamper in bundle.sig.v3.json to fail but verify passed"
  exit 1
fi

TELEGA_REGISTRY_MISMATCH="$tmp_registry_mismatch" node --import tsx --input-type=module <<'EOF'
import fs from "node:fs";
const src = "scripts/telecore-key-registry.k2.12.json";
const dst = process.env.TELEGA_REGISTRY_MISMATCH;
if (!dst) throw new Error("TELEGA_REGISTRY_MISMATCH missing");
const reg = JSON.parse(fs.readFileSync(src, "utf8"));
reg.updated_at = "2026-02-28T00:00:00.000Z";
fs.writeFileSync(dst, JSON.stringify(reg));
EOF

if TELECORE_KEY_REGISTRY_PATH="$tmp_registry_mismatch" node --import tsx scripts/verify-unified-bundle-signed-zip-k2.16.ts "$tmp_zip"; then
  echo "Expected pinned registry mismatch to fail but verify passed"
  exit 1
fi

echo "🎉 K2.16 smoke passed"
