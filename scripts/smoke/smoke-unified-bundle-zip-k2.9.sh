#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Unified ZIP Bundle (K2.9)"
echo "========================================"

node --import tsx --input-type=module <<'EOF'
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

function parseZipStoreEntries(zipBuffer) {
  const entries = [];
  let offset = 0;
  while (offset + 4 <= zipBuffer.length) {
    const sig = zipBuffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) {
      break;
    }
    const flags = zipBuffer.readUInt16LE(offset + 6);
    const method = zipBuffer.readUInt16LE(offset + 8);
    const compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const nameLen = zipBuffer.readUInt16LE(offset + 26);
    const extraLen = zipBuffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLen;
    const dataStart = nameEnd + extraLen;
    const dataEnd = dataStart + compressedSize;
    const name = zipBuffer.subarray(nameStart, nameEnd).toString('utf8');
    const content = zipBuffer.subarray(dataStart, dataEnd);
    entries.push({ name, method, flags, content });
    offset = dataEnd;
  }
  return entries;
}

const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);

const subject = 'demo_user';
const receipts = userBillingService.getReceipts(subject);
if (!receipts.length) {
  throw new Error('Expected receipts for ZIP bundle');
}
const dispute = userBillingService.createDispute(subject, receipts[0].receipt_id, 'ZIP bundle smoke');
userBillingService.simulateDisputeStatus(subject, dispute.dispute_id, 'reviewing', 'maker');

const exportedAt = '2026-02-26T00:00:00.000Z';
const options = {
  receiptIds: [receipts[0].receipt_id],
  disputeIds: [dispute.dispute_id],
  exportedAt,
};

const a = userBillingService.getUnifiedExportZipBundle(subject, options);
const b = userBillingService.getUnifiedExportZipBundle(subject, options);
if (!a.zip.equals(b.zip)) {
  throw new Error('ZIP bundle is not byte-identical for same input');
}

const entries = parseZipStoreEntries(a.zip);
if (!entries.length) {
  throw new Error('ZIP bundle has no entries');
}
for (const entry of entries) {
  if (entry.method !== 0 || entry.flags !== 0) {
    throw new Error(`ZIP entry is not deterministic STORE/no-flags: ${entry.name}`);
  }
}

const names = entries.map((entry) => entry.name);
const sortedNames = [...names].sort((x, y) => x.localeCompare(y));
if (JSON.stringify(names) !== JSON.stringify(sortedNames)) {
  throw new Error('ZIP entry order is not deterministic');
}

const expectedNames = [...a.files.map((f) => f.path)].sort((x, y) => x.localeCompare(y));
if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
  throw new Error('ZIP entry set does not match service file index');
}

const fileMap = new Map(entries.map((entry) => [entry.name, entry.content]));
const bundleSha = fileMap.get('bundle.sha256');
if (!bundleSha) {
  throw new Error('bundle.sha256 is missing in ZIP');
}
const bundleShaText = bundleSha.toString('utf8');
if (bundleShaText !== `${a.bundle_digest_sha256}\n`) {
  throw new Error('bundle.sha256 content mismatch');
}

for (const file of a.files) {
  const content = fileMap.get(file.path);
  if (!content) {
    throw new Error(`Missing file in ZIP: ${file.path}`);
  }
  const digest = createHash('sha256').update(content).digest('hex');
  if (digest !== file.digest_sha256) {
    throw new Error(`Per-file digest mismatch for ${file.path}`);
  }
  if (content.length !== file.size_bytes) {
    throw new Error(`Per-file size mismatch for ${file.path}`);
  }
}

const other = userBillingService.getUnifiedExportZipBundle('other_user', options);
const otherEntries = parseZipStoreEntries(other.zip);
const otherDump = otherEntries.map((entry) => `${entry.name}:${entry.content.toString('utf8')}`).join('\n').toLowerCase();
for (const marker of [receipts[0].receipt_id.toLowerCase(), dispute.dispute_id.toLowerCase()]) {
  if (otherDump.includes(marker)) {
    throw new Error('Ownership isolation failed for ZIP bundle');
  }
}
for (const marker of ['ledger_', 'ledgerrefs', 'trace', 'internal', 'subject_id']) {
  if (otherDump.includes(marker)) {
    throw new Error(`Unsafe marker leaked in ZIP bundle: ${marker}`);
  }
}

console.log('✅ Byte-identical deterministic ZIP');
console.log('✅ STORE mode + deterministic entry ordering');
console.log('✅ bundle.sha256 and per-file digests verified');
console.log('✅ Ownership isolation and safety validated');
EOF

echo "🎉 K2.9 smoke passed"
