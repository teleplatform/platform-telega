#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Policy Digest Pin (K2.18)"
echo "======================================="

tmp_zip="$(mktemp -t telega_k218_ok_XXXXXX).zip"
tmp_bad_policy_pin="$(mktemp -t telega_k218_bad_policy_pin_XXXXXX).zip"
tmp_policy_mismatch="$(mktemp -t telega_k218_policy_mismatch_XXXXXX).json"
trap 'rm -f "$tmp_zip" "$tmp_bad_policy_pin" "$tmp_policy_mismatch"' EXIT

TELEGA_TMP_ZIP="$tmp_zip" TELEGA_TMP_BAD_POLICY_PIN="$tmp_bad_policy_pin" node --import tsx --input-type=module <<'EOF'
import fs from "node:fs";
import { pathToFileURL } from "node:url";

function parseZipEntriesWithOffsets(zipBuffer) {
  const entries = [];
  let offset = 0;
  while (offset + 30 <= zipBuffer.length) {
    const sig = zipBuffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const nameLen = zipBuffer.readUInt16LE(offset + 26);
    const extraLen = zipBuffer.readUInt16LE(offset + 28);
    const compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLen;
    const dataStart = nameEnd + extraLen;
    const dataEnd = dataStart + compressedSize;
    entries.push({
      name: zipBuffer.subarray(nameStart, nameEnd).toString("utf8"),
      dataStart,
      dataEnd,
    });
    offset = dataEnd;
  }
  return entries;
}

const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);
const subject = "demo_user";
const receipts = userBillingService.getReceipts(subject);
if (!receipts.length) throw new Error("Expected receipts for K2.18 smoke");
const dispute = userBillingService.createDispute(subject, receipts[0].receipt_id, "K2.18 smoke");
userBillingService.simulateDisputeStatus(subject, dispute.dispute_id, "reviewing", "maker");

const payload = userBillingService.getUnifiedExportSignedZipBundle(subject, {
  receiptIds: [receipts[0].receipt_id],
  disputeIds: [dispute.dispute_id],
  exportedAt: "2026-02-26T00:00:00.000Z",
});
const out = process.env.TELEGA_TMP_ZIP;
const badOut = process.env.TELEGA_TMP_BAD_POLICY_PIN;
if (!out || !badOut) throw new Error("temp paths missing");
fs.writeFileSync(out, payload.zip);

const entries = parseZipEntriesWithOffsets(payload.zip);
const policyEntry = entries.find((e) => e.name === "bundle.policy.json");
if (!policyEntry) throw new Error("bundle.policy.json missing");
const bad = Buffer.from(payload.zip);
bad[policyEntry.dataStart] = bad[policyEntry.dataStart] === 0x7b ? 0x7a : 0x7b;
fs.writeFileSync(badOut, bad);
EOF

node --import tsx scripts/verify-unified-bundle-signed-zip-k2.17.ts "$tmp_zip"

if node --import tsx scripts/verify-unified-bundle-signed-zip-k2.17.ts "$tmp_bad_policy_pin"; then
  echo "Expected bundle.policy.json tamper to fail but verify passed"
  exit 1
fi

TELEGA_POLICY_MISMATCH="$tmp_policy_mismatch" node --import tsx --input-type=module <<'EOF'
import fs from "node:fs";
const src = "scripts/telecore-signature-policy.k2.17.json";
const dst = process.env.TELEGA_POLICY_MISMATCH;
if (!dst) throw new Error("TELEGA_POLICY_MISMATCH missing");
const policy = JSON.parse(fs.readFileSync(src, "utf8"));
policy.updated_at = "2026-02-28T00:00:00.000Z";
fs.writeFileSync(dst, JSON.stringify(policy));
EOF

if TELECORE_SIGNATURE_POLICY_PATH="$tmp_policy_mismatch" node --import tsx scripts/verify-unified-bundle-signed-zip-k2.17.ts "$tmp_zip"; then
  echo "Expected policy digest mismatch to fail but verify passed"
  exit 1
fi

echo "🎉 K2.18 smoke passed"
