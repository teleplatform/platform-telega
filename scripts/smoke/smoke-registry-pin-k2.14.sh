#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Registry Digest Pin (K2.14)"
echo "========================================="

tmp_zip="$(mktemp -t telega_k214_signed_XXXXXX).zip"
tmp_bad_pin="$(mktemp -t telega_k214_bad_pin_XXXXXX).zip"
tmp_registry_mismatch="$(mktemp -t telega_k214_reg_mismatch_XXXXXX).json"
trap 'rm -f "$tmp_zip" "$tmp_bad_pin" "$tmp_registry_mismatch"' EXIT

TELEGA_TMP_ZIP="$tmp_zip" TELEGA_TMP_BAD_PIN="$tmp_bad_pin" node --import tsx --input-type=module <<'EOF'
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
if (!receipts.length) throw new Error("Expected receipts for K2.14 smoke");
const dispute = userBillingService.createDispute(subject, receipts[0].receipt_id, "K2.14 smoke");
userBillingService.simulateDisputeStatus(subject, dispute.dispute_id, "reviewing", "maker");

const payload = userBillingService.getUnifiedExportSignedZipBundle(subject, {
  receiptIds: [receipts[0].receipt_id],
  disputeIds: [dispute.dispute_id],
  exportedAt: "2026-02-26T00:00:00.000Z",
});
const out = process.env.TELEGA_TMP_ZIP;
const badOut = process.env.TELEGA_TMP_BAD_PIN;
if (!out || !badOut) throw new Error("temp paths missing");
fs.writeFileSync(out, payload.zip);

const entries = parseZipEntriesWithOffsets(payload.zip);
const reg = entries.find((e) => e.name === "bundle.registry.json");
if (!reg) throw new Error("bundle.registry.json missing");
const bad = Buffer.from(payload.zip);
bad[reg.dataStart] = bad[reg.dataStart] === 0x7b ? 0x7a : 0x7b; // mutate first byte
fs.writeFileSync(badOut, bad);
EOF

node --import tsx scripts/verify-unified-bundle-signed-zip-k2.12.ts "$tmp_zip"

if node --import tsx scripts/verify-unified-bundle-signed-zip-k2.12.ts "$tmp_bad_pin"; then
  echo "Expected bundle.registry.json tamper to fail but verify passed"
  exit 1
fi

TELEGA_REG_MISMATCH="$tmp_registry_mismatch" node --import tsx --input-type=module <<'EOF'
import fs from "node:fs";
const src = "scripts/telecore-key-registry.k2.12.json";
const dst = process.env.TELEGA_REG_MISMATCH;
if (!dst) throw new Error("TELEGA_REG_MISMATCH missing");
const reg = JSON.parse(fs.readFileSync(src, "utf8"));
reg.updated_at = "2026-02-28T00:00:00.000Z";
fs.writeFileSync(dst, JSON.stringify(reg));
EOF

if TELECORE_KEY_REGISTRY_PATH="$tmp_registry_mismatch" node --import tsx scripts/verify-unified-bundle-signed-zip-k2.12.ts "$tmp_zip"; then
  echo "Expected pinned registry digest mismatch to fail but verify passed"
  exit 1
fi

echo "🎉 K2.14 smoke passed"
