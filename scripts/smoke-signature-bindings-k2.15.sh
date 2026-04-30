#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Signature Bindings v2 (K2.15)"
echo "==========================================="

tmp_zip="$(mktemp -t telega_k215_ok_XXXXXX).zip"
tmp_bad_registry="$(mktemp -t telega_k215_bad_registry_XXXXXX).zip"
tmp_bad_sigjson="$(mktemp -t telega_k215_bad_sigjson_XXXXXX).zip"
tmp_bad_keyid_sigjson="$(mktemp -t telega_k215_bad_keyid_XXXXXX).zip"
tmp_registry_mismatch="$(mktemp -t telega_k215_registry_mismatch_XXXXXX).json"
trap 'rm -f "$tmp_zip" "$tmp_bad_registry" "$tmp_bad_sigjson" "$tmp_bad_keyid_sigjson" "$tmp_registry_mismatch"' EXIT

TELEGA_TMP_ZIP="$tmp_zip" \
TELEGA_TMP_BAD_REGISTRY="$tmp_bad_registry" \
TELEGA_TMP_BAD_SIGJSON="$tmp_bad_sigjson" \
TELEGA_TMP_BAD_KEYID="$tmp_bad_keyid_sigjson" \
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
if (!receipts.length) throw new Error("Expected receipts for K2.15 smoke");
const dispute = userBillingService.createDispute(subject, receipts[0].receipt_id, "K2.15 smoke");
userBillingService.simulateDisputeStatus(subject, dispute.dispute_id, "reviewing", "maker");

const payload = userBillingService.getUnifiedExportSignedZipBundle(subject, {
  receiptIds: [receipts[0].receipt_id],
  disputeIds: [dispute.dispute_id],
  exportedAt: "2026-02-26T00:00:00.000Z",
});

const out = process.env.TELEGA_TMP_ZIP;
const badRegistry = process.env.TELEGA_TMP_BAD_REGISTRY;
const badSig = process.env.TELEGA_TMP_BAD_SIGJSON;
const badKeyId = process.env.TELEGA_TMP_BAD_KEYID;
if (!out || !badRegistry || !badSig || !badKeyId) throw new Error("temp paths missing");
fs.writeFileSync(out, payload.zip);

const entries = parseZipEntriesWithOffsets(payload.zip);

const regEntry = entries.find((e) => e.name === "bundle.registry.json");
if (!regEntry) throw new Error("bundle.registry.json missing");
const badReg = Buffer.from(payload.zip);
badReg[regEntry.dataStart] = badReg[regEntry.dataStart] === 0x7b ? 0x7a : 0x7b;
fs.writeFileSync(badRegistry, badReg);

const sigEntry = entries.find((e) => e.name === "bundle.sig.json");
if (!sigEntry) throw new Error("bundle.sig.json missing");
const badSigBuf = Buffer.from(payload.zip);
badSigBuf[sigEntry.dataStart] = badSigBuf[sigEntry.dataStart] === 0x7b ? 0x7a : 0x7b;
fs.writeFileSync(badSig, badSigBuf);

const sigJsonText = payload.zip.subarray(sigEntry.dataStart, sigEntry.dataEnd).toString("utf8");
const replaced = sigJsonText.replace("telecore_dev_2026q1", "telecore_dev_2026q2");
if (replaced.length !== sigJsonText.length) throw new Error("unexpected key_id length change");
if (replaced === sigJsonText) throw new Error("key_id replacement did not apply");
const badKeyBuf = Buffer.from(payload.zip);
badKeyBuf.write(replaced, sigEntry.dataStart, "utf8");
fs.writeFileSync(badKeyId, badKeyBuf);
EOF

node --import tsx scripts/verify-unified-bundle-signed-zip-k2.15.ts "$tmp_zip"

if node --import tsx scripts/verify-unified-bundle-signed-zip-k2.15.ts "$tmp_bad_registry"; then
  echo "Expected bundle.registry.json tamper to fail but verify passed"
  exit 1
fi

if node --import tsx scripts/verify-unified-bundle-signed-zip-k2.15.ts "$tmp_bad_sigjson"; then
  echo "Expected bundle.sig.json tamper to fail but verify passed"
  exit 1
fi

if node --import tsx scripts/verify-unified-bundle-signed-zip-k2.15.ts "$tmp_bad_keyid_sigjson"; then
  echo "Expected key_id tamper in bundle.sig.json to fail but verify passed"
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

if TELECORE_KEY_REGISTRY_PATH="$tmp_registry_mismatch" node --import tsx scripts/verify-unified-bundle-signed-zip-k2.15.ts "$tmp_zip"; then
  echo "Expected pinned registry mismatch to fail but verify passed"
  exit 1
fi

echo "🎉 K2.15 smoke passed"
