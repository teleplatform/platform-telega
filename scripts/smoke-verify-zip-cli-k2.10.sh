#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Verify CLI ZIP (K2.10)"
echo "====================================="

tmp="$(mktemp -t telega_zip_XXXXXX).zip"
trap 'rm -f "$tmp"' EXIT

TELEGA_TMP_ZIP="$tmp" node --import tsx --input-type=module <<'EOF'
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);

const subject = "demo_user";
const receipts = userBillingService.getReceipts(subject);
if (!receipts.length) throw new Error("Expected receipts for K2.10 smoke");

const dispute = userBillingService.createDispute(subject, receipts[0].receipt_id, "K2.10 smoke");
userBillingService.simulateDisputeStatus(subject, dispute.dispute_id, "reviewing", "maker");

const exportedAt = "2026-02-26T00:00:00.000Z";
const payload = userBillingService.getUnifiedExportZipBundle(subject, {
  receiptIds: [receipts[0].receipt_id],
  disputeIds: [dispute.dispute_id],
  exportedAt,
});

const out = process.env.TELEGA_TMP_ZIP;
if (!out) throw new Error("TELEGA_TMP_ZIP is required");
fs.writeFileSync(out, payload.zip);
console.log("ZIP written:", out, payload.zip.length, "bytes");
EOF

node --import tsx scripts/verify-unified-bundle-zip-k2.10.ts "$tmp"
echo "🎉 K2.10 smoke passed"
