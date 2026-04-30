#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Key Rotation (K2.13)"
echo "==================================="

KEY_A_ID="telecore_dev_2026q1"
KEY_B_ID="telecore_dev_2026q2"
KEY_A_PRIV_B64="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
KEY_B_PRIV_B64="AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA="
EXPORTED_AT="2026-02-26T00:00:00.000Z"

tmp_zip_a="$(mktemp -t telega_k213_keya_XXXXXX).zip"
tmp_zip_b="$(mktemp -t telega_k213_keyb_XXXXXX).zip"
tmp_registry_retired="$(mktemp -t telega_k213_retired_XXXXXX).json"
tmp_registry_revoked="$(mktemp -t telega_k213_revoked_XXXXXX).json"
trap 'rm -f "$tmp_zip_a" "$tmp_zip_b" "$tmp_registry_retired" "$tmp_registry_revoked"' EXIT

TELEGA_TMP_ZIP="$tmp_zip_a" \
TELECORE_SIGNING_KEY_ID="$KEY_A_ID" \
TELECORE_SIGNING_KEY_ED25519_B64="$KEY_A_PRIV_B64" \
node --import tsx --input-type=module <<'EOF'
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);
const subject = "demo_user";
const receipts = userBillingService.getReceipts(subject);
if (!receipts.length) throw new Error("Expected receipts for K2.13 smoke");
const dispute = userBillingService.createDispute(subject, receipts[0].receipt_id, "K2.13 keyA");
userBillingService.simulateDisputeStatus(subject, dispute.dispute_id, "reviewing", "maker");
const payload = userBillingService.getUnifiedExportSignedZipBundle(subject, {
  receiptIds: [receipts[0].receipt_id],
  disputeIds: [dispute.dispute_id],
  exportedAt: "2026-02-26T00:00:00.000Z",
});
const out = process.env.TELEGA_TMP_ZIP;
if (!out) throw new Error("TELEGA_TMP_ZIP missing");
fs.writeFileSync(out, payload.zip);
EOF

node --import tsx scripts/verify-unified-bundle-signed-zip-k2.12.ts "$tmp_zip_a"

TELEGA_TMP_ZIP="$tmp_zip_b" \
TELECORE_SIGNING_KEY_ID="$KEY_B_ID" \
TELECORE_SIGNING_KEY_ED25519_B64="$KEY_B_PRIV_B64" \
node --import tsx --input-type=module <<'EOF'
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);
const subject = "demo_user";
const receipts = userBillingService.getReceipts(subject);
if (!receipts.length) throw new Error("Expected receipts for K2.13 smoke");
const dispute = userBillingService.createDispute(subject, receipts[0].receipt_id, "K2.13 keyB");
userBillingService.simulateDisputeStatus(subject, dispute.dispute_id, "reviewing", "maker");
const payload = userBillingService.getUnifiedExportSignedZipBundle(subject, {
  receiptIds: [receipts[0].receipt_id],
  disputeIds: [dispute.dispute_id],
  exportedAt: "2026-02-26T00:00:00.000Z",
});
const out = process.env.TELEGA_TMP_ZIP;
if (!out) throw new Error("TELEGA_TMP_ZIP missing");
fs.writeFileSync(out, payload.zip);
EOF

node --import tsx scripts/verify-unified-bundle-signed-zip-k2.12.ts "$tmp_zip_b"

TELEGA_RET_REG="$tmp_registry_retired" node --import tsx --input-type=module <<'EOF'
import fs from "node:fs";
const src = "scripts/telecore-key-registry.k2.12.json";
const dst = process.env.TELEGA_RET_REG;
if (!dst) throw new Error("TELEGA_RET_REG missing");
const reg = JSON.parse(fs.readFileSync(src, "utf8"));
const keyA = reg.keys.find((k) => k.key_id === "telecore_dev_2026q1");
if (!keyA) throw new Error("keyA missing");
keyA.status = "retired";
keyA.retired_at = "2026-04-01T00:00:00.000Z";
delete keyA.revoked_at;
fs.writeFileSync(dst, JSON.stringify(reg));
EOF

TELECORE_VERIFY_IGNORE_REGISTRY_PIN="1" TELECORE_KEY_REGISTRY_PATH="$tmp_registry_retired" node --import tsx scripts/verify-unified-bundle-signed-zip-k2.12.ts "$tmp_zip_a"

TELEGA_REV_REG="$tmp_registry_revoked" node --import tsx --input-type=module <<'EOF'
import fs from "node:fs";
const src = "scripts/telecore-key-registry.k2.12.json";
const dst = process.env.TELEGA_REV_REG;
if (!dst) throw new Error("TELEGA_REV_REG missing");
const reg = JSON.parse(fs.readFileSync(src, "utf8"));
const keyA = reg.keys.find((k) => k.key_id === "telecore_dev_2026q1");
if (!keyA) throw new Error("keyA missing");
keyA.status = "revoked";
keyA.revoked_at = "2026-01-01T00:00:00.000Z";
delete keyA.retired_at;
fs.writeFileSync(dst, JSON.stringify(reg));
EOF

if TELECORE_VERIFY_IGNORE_REGISTRY_PIN="1" TELECORE_KEY_REGISTRY_PATH="$tmp_registry_revoked" node --import tsx scripts/verify-unified-bundle-signed-zip-k2.12.ts "$tmp_zip_a"; then
  echo "Expected revoked-before-export verification failure"
  exit 1
fi

if TELECORE_SIGNING_KEY_ID="$KEY_A_ID" TELECORE_SIGNING_KEY_ED25519_B64="$KEY_A_PRIV_B64" TELECORE_KEY_REGISTRY_PATH="$tmp_registry_retired" node --import tsx --input-type=module <<'EOF'
import { pathToFileURL } from "node:url";
const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);
const subject = "demo_user";
const receipt = userBillingService.getReceipts(subject)[0];
if (!receipt) throw new Error("No receipt found");
userBillingService.getUnifiedExportSignedZipBundle(subject, {
  receiptIds: [receipt.receipt_id],
  disputeIds: [],
  exportedAt: "2026-02-26T00:00:00.000Z",
});
EOF
then
  echo "Expected signing failure for retired key but signing passed"
  exit 1
fi

if TELECORE_SIGNING_KEY_ID="$KEY_A_ID" TELECORE_SIGNING_KEY_ED25519_B64="$KEY_A_PRIV_B64" TELECORE_KEY_REGISTRY_PATH="$tmp_registry_revoked" node --import tsx --input-type=module <<'EOF'
import { pathToFileURL } from "node:url";
const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);
const subject = "demo_user";
const receipt = userBillingService.getReceipts(subject)[0];
if (!receipt) throw new Error("No receipt found");
userBillingService.getUnifiedExportSignedZipBundle(subject, {
  receiptIds: [receipt.receipt_id],
  disputeIds: [],
  exportedAt: "2026-02-26T00:00:00.000Z",
});
EOF
then
  echo "Expected signing failure for revoked key but signing passed"
  exit 1
fi

echo "✅ Rotation scenario keyA -> keyB -> retired -> revoked verified"
echo "🎉 K2.13 smoke passed"
