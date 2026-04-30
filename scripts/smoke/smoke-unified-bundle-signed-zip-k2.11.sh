#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Unified Signed ZIP Bundle (K2.11)"
echo "================================================"

tmp1="$(mktemp -t telega_signed_zip1_XXXXXX).zip"
tmp2="$(mktemp -t telega_signed_zip2_XXXXXX).zip"
tmp_bad1="$(mktemp -t telega_signed_zip_bad1_XXXXXX).zip"
tmp_bad2="$(mktemp -t telega_signed_zip_bad2_XXXXXX).zip"
trap 'rm -f "$tmp1" "$tmp2" "$tmp_bad1" "$tmp_bad2"' EXIT

TELEGA_TMP_ZIP1="$tmp1" TELEGA_TMP_ZIP2="$tmp2" TELEGA_TMP_ZIP_BAD1="$tmp_bad1" TELEGA_TMP_ZIP_BAD2="$tmp_bad2" node --import tsx --input-type=module <<'EOF'
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
if (!receipts.length) throw new Error("Expected receipts for K2.11 smoke");

const dispute = userBillingService.createDispute(subject, receipts[0].receipt_id, "K2.11 smoke");
userBillingService.simulateDisputeStatus(subject, dispute.dispute_id, "reviewing", "maker");

const exportedAt = "2026-02-26T00:00:00.000Z";
const opts = {
  receiptIds: [receipts[0].receipt_id],
  disputeIds: [dispute.dispute_id],
  exportedAt,
};

const p1 = userBillingService.getUnifiedExportSignedZipBundle(subject, opts);
const p2 = userBillingService.getUnifiedExportSignedZipBundle(subject, opts);
if (!p1.zip.equals(p2.zip)) {
  throw new Error("Signed ZIP is not byte-identical for same input");
}

const out1 = process.env.TELEGA_TMP_ZIP1;
const out2 = process.env.TELEGA_TMP_ZIP2;
const bad1 = process.env.TELEGA_TMP_ZIP_BAD1;
const bad2 = process.env.TELEGA_TMP_ZIP_BAD2;
if (!out1 || !out2 || !bad1 || !bad2) throw new Error("temp paths missing");
fs.writeFileSync(out1, p1.zip);
fs.writeFileSync(out2, p2.zip);

const entries = parseZipEntriesWithOffsets(p1.zip);
const fileNames = entries.map((e) => e.name).join("\n").toLowerCase();
if (fileNames.includes("subject_id") || fileNames.includes("trace") || fileNames.includes("ledger_")) {
  throw new Error("unsafe names detected in signed ZIP");
}

const tamperedAny = Buffer.from(p1.zip);
const manifest = entries.find((e) => e.name === "manifest.json");
if (!manifest) throw new Error("manifest.json missing");
if (manifest.dataStart >= manifest.dataEnd) throw new Error("manifest payload empty");
tamperedAny[manifest.dataStart] = tamperedAny[manifest.dataStart] ^ 0x01;
fs.writeFileSync(bad1, tamperedAny);

const tamperedSig = Buffer.from(p1.zip);
const sig = entries.find((e) => e.name === "bundle.sig");
if (!sig) throw new Error("bundle.sig missing");
if (sig.dataStart >= sig.dataEnd) throw new Error("bundle.sig payload empty");
tamperedSig[sig.dataStart] = tamperedSig[sig.dataStart] === 0x41 ? 0x42 : 0x41; // mutate first byte
fs.writeFileSync(bad2, tamperedSig);
EOF

node --import tsx scripts/verify-unified-bundle-signed-zip-k2.11.ts "$tmp1"

if node --import tsx scripts/verify-unified-bundle-signed-zip-k2.11.ts "$tmp_bad1"; then
  echo "Expected failure for content-tampered archive but verify passed"
  exit 1
fi

if node --import tsx scripts/verify-unified-bundle-signed-zip-k2.11.ts "$tmp_bad2"; then
  echo "Expected failure for signature-tampered archive but verify passed"
  exit 1
fi

echo "🎉 K2.11 smoke passed"
