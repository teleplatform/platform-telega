#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Verify Signed ZIP With Registry (K2.12)"
echo "======================================================="

tmp_zip="$(mktemp -t telega_signed_k212_XXXXXX).zip"
tmp_bad_keyid="$(mktemp -t telega_signed_k212_bad_keyid_XXXXXX).zip"
tmp_registry_revoked="$(mktemp -t telega_registry_revoked_XXXXXX).json"
tmp_registry_badpub="$(mktemp -t telega_registry_badpub_XXXXXX).json"
trap 'rm -f "$tmp_zip" "$tmp_bad_keyid" "$tmp_registry_revoked" "$tmp_registry_badpub"' EXIT

TELEGA_TMP_ZIP="$tmp_zip" TELEGA_TMP_BAD_KEYID="$tmp_bad_keyid" node --import tsx --input-type=module <<'EOF'
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
if (!receipts.length) throw new Error("Expected receipts for K2.12 smoke");
const dispute = userBillingService.createDispute(subject, receipts[0].receipt_id, "K2.12 smoke");
userBillingService.simulateDisputeStatus(subject, dispute.dispute_id, "reviewing", "maker");

const payload = userBillingService.getUnifiedExportSignedZipBundle(subject, {
  receiptIds: [receipts[0].receipt_id],
  disputeIds: [dispute.dispute_id],
  exportedAt: "2026-02-26T00:00:00.000Z",
});

const out = process.env.TELEGA_TMP_ZIP;
const badOut = process.env.TELEGA_TMP_BAD_KEYID;
if (!out || !badOut) throw new Error("temp paths missing");
fs.writeFileSync(out, payload.zip);

const mutated = Buffer.from(payload.zip);
const entries = parseZipEntriesWithOffsets(mutated);
const pub = entries.find((e) => e.name === "bundle.pub.json");
if (!pub) throw new Error("bundle.pub.json missing");
const text = mutated.subarray(pub.dataStart, pub.dataEnd).toString("utf8");
const replaced = text.replace("telecore_dev_2026q1", "telecore_dev_2026qX");
if (replaced.length !== text.length) throw new Error("unexpected length change during key_id tamper");
mutated.write(replaced, pub.dataStart, "utf8");
fs.writeFileSync(badOut, mutated);
EOF

node --import tsx scripts/verify-unified-bundle-signed-zip-k2.12.ts "$tmp_zip"

if node --import tsx scripts/verify-unified-bundle-signed-zip-k2.12.ts "$tmp_bad_keyid"; then
  echo "Expected key_id tamper to fail but verify passed"
  exit 1
fi

TELEGA_REGISTRY_REVOKED="$tmp_registry_revoked" node --import tsx --input-type=module <<'EOF'
import fs from "node:fs";
const src = "scripts/telecore-key-registry.k2.12.json";
const dst = process.env.TELEGA_REGISTRY_REVOKED;
if (!dst) throw new Error("TELEGA_REGISTRY_REVOKED missing");
const reg = JSON.parse(fs.readFileSync(src, "utf8"));
reg.keys[0].status = "revoked";
reg.keys[0].revoked_at = "2026-01-01T00:00:00.000Z";
fs.writeFileSync(dst, JSON.stringify(reg));
EOF

if TELECORE_KEY_REGISTRY_PATH="$tmp_registry_revoked" node --import tsx scripts/verify-unified-bundle-signed-zip-k2.12.ts "$tmp_zip"; then
  echo "Expected revoked key registry to fail but verify passed"
  exit 1
fi

TELEGA_REGISTRY_BADPUB="$tmp_registry_badpub" node --import tsx --input-type=module <<'EOF'
import fs from "node:fs";
const src = "scripts/telecore-key-registry.k2.12.json";
const dst = process.env.TELEGA_REGISTRY_BADPUB;
if (!dst) throw new Error("TELEGA_REGISTRY_BADPUB missing");
const reg = JSON.parse(fs.readFileSync(src, "utf8"));
reg.keys[0].public_key_spki_b64 = "MCowBQYDK2VwAyEA//////////////////////////////////////////8=";
fs.writeFileSync(dst, JSON.stringify(reg));
EOF

if TELECORE_KEY_REGISTRY_PATH="$tmp_registry_badpub" node --import tsx scripts/verify-unified-bundle-signed-zip-k2.12.ts "$tmp_zip"; then
  echo "Expected bad pubkey registry to fail but verify passed"
  exit 1
fi

echo "🎉 K2.12 verify-with-registry smoke passed"
