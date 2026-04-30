#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Key Registry (K2.12)"
echo "==================================="

d1="$(node --import tsx scripts/telecore-key-registry.k2.12.ts --digest)"
d2="$(node --import tsx scripts/telecore-key-registry.k2.12.ts --digest)"

if [[ "$d1" != "$d2" ]]; then
  echo "Registry digest is not deterministic"
  exit 1
fi

node --import tsx --input-type=module <<'EOF'
import { loadRegistry } from "./scripts/telecore-key-registry.k2.12.ts";

const { registry } = loadRegistry();
const keyIds = registry.keys.map((k) => k.key_id);
const sorted = [...keyIds].sort((a, b) => a.localeCompare(b));
if (JSON.stringify(keyIds) !== JSON.stringify(sorted)) {
  throw new Error("Registry key order is not canonical");
}
if (!registry.policy.require_key_id_match) {
  throw new Error("Policy require_key_id_match must be true");
}
if (registry.policy.allow_embedded_pubkey_fallback !== false) {
  throw new Error("Policy allow_embedded_pubkey_fallback must be false");
}
if (!registry.policy.accept_if_key_status.includes("active")) {
  throw new Error("Policy must accept active keys");
}
console.log("✅ Registry canonical order and policy validated");
EOF

echo "✅ Registry digest deterministic: $d1"
echo "🎉 K2.12 registry smoke passed"
