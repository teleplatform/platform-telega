#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Anti-Downgrade Policy Gate (K2.17)"
echo "================================================="

tmp_zip="$(mktemp -t telega_k217_ok_XXXXXX).zip"
tmp_downgraded="$(mktemp -t telega_k217_downgraded_XXXXXX).zip"
tmp_policy_bad="$(mktemp -t telega_k217_bad_policy_XXXXXX).json"
trap 'rm -f "$tmp_zip" "$tmp_downgraded" "$tmp_policy_bad"' EXIT

TELEGA_TMP_ZIP="$tmp_zip" TELEGA_TMP_DOWNGRADED="$tmp_downgraded" node --import tsx --input-type=module <<'EOF'
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
    entries.push({ nameStart, nameEnd, name: zipBuffer.subarray(nameStart, nameEnd).toString("utf8") });
    offset = dataEnd;
  }
  return entries;
}

const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);
const subject = "demo_user";
const receipts = userBillingService.getReceipts(subject);
if (!receipts.length) throw new Error("Expected receipts for K2.17 smoke");
const dispute = userBillingService.createDispute(subject, receipts[0].receipt_id, "K2.17 smoke");
userBillingService.simulateDisputeStatus(subject, dispute.dispute_id, "reviewing", "maker");

const payload = userBillingService.getUnifiedExportSignedZipBundle(subject, {
  receiptIds: [receipts[0].receipt_id],
  disputeIds: [dispute.dispute_id],
  exportedAt: "2026-02-26T00:00:00.000Z",
});

const out = process.env.TELEGA_TMP_ZIP;
const downgradedOut = process.env.TELEGA_TMP_DOWNGRADED;
if (!out || !downgradedOut) throw new Error("temp paths missing");
fs.writeFileSync(out, payload.zip);

const entries = parseZipEntriesWithOffsets(payload.zip);
const sigV3 = entries.find((e) => e.name === "bundle.sig.v3.json");
if (!sigV3) throw new Error("bundle.sig.v3.json missing");
const downgraded = Buffer.from(payload.zip);
downgraded.write("bundle.sig.v2.json", sigV3.nameStart, "utf8");
fs.writeFileSync(downgradedOut, downgraded);
EOF

node --import tsx scripts/verify-unified-bundle-signed-zip-k2.17.ts "$tmp_zip"

if node --import tsx scripts/verify-unified-bundle-signed-zip-k2.17.ts "$tmp_downgraded"; then
  echo "Expected anti-downgrade failure for missing v3 signature entry but verify passed"
  exit 1
fi

cat > "$tmp_policy_bad" <<'JSON'
{
  "kind": "telecore_signature_policy",
  "version": "v1",
  "updated_at": "2026-02-27T00:00:00.000Z",
  "required_message_v": "v4",
  "allow_legacy_verify": false
}
JSON

if TELECORE_SIGNATURE_POLICY_PATH="$tmp_policy_bad" node --import tsx scripts/verify-unified-bundle-signed-zip-k2.17.ts "$tmp_zip"; then
  echo "Expected policy gate failure on unsupported required_message_v but verify passed"
  exit 1
fi

echo "🎉 K2.17 smoke passed"
