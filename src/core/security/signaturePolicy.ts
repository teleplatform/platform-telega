import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type SignaturePolicy = {
  kind: "telecore_signature_policy";
  version: "v1";
  updated_at: string;
  required_message_v: "v3";
  allow_legacy_verify: boolean;
};

function fail(msg: string): never {
  throw new Error(`[K2.17] ${msg}`);
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return false;
  return new Date(t).toISOString() === value;
}

export function canonicalizeSignaturePolicy(raw: SignaturePolicy): SignaturePolicy {
  if (raw.kind !== "telecore_signature_policy" || raw.version !== "v1") {
    fail("signature policy kind/version invalid");
  }
  if (!isIsoDateString(raw.updated_at)) {
    fail("signature policy updated_at must be ISO UTC date");
  }
  if (raw.required_message_v !== "v3") {
    fail(`unsupported required_message_v: ${String(raw.required_message_v)}`);
  }
  if (typeof raw.allow_legacy_verify !== "boolean") {
    fail("signature policy allow_legacy_verify must be boolean");
  }
  return {
    kind: "telecore_signature_policy",
    version: "v1",
    updated_at: raw.updated_at,
    required_message_v: "v3",
    allow_legacy_verify: raw.allow_legacy_verify,
  };
}

export function canonicalSignaturePolicyString(policy: SignaturePolicy): string {
  return JSON.stringify(canonicalizeSignaturePolicy(policy));
}

export function signaturePolicyDigest(policy: SignaturePolicy): string {
  return sha256Hex(canonicalSignaturePolicyString(policy));
}

export function loadSignaturePolicy(policyPath?: string): { policy: SignaturePolicy; digest_sha256: string; path: string } {
  const resolved = path.resolve(process.cwd(), policyPath || "scripts/telecore-signature-policy.k2.17.json");
  if (!fs.existsSync(resolved)) fail(`signature policy file not found: ${resolved}`);
  const raw = JSON.parse(fs.readFileSync(resolved, "utf8")) as SignaturePolicy;
  const policy = canonicalizeSignaturePolicy(raw);
  return {
    policy,
    digest_sha256: signaturePolicyDigest(policy),
    path: resolved,
  };
}
