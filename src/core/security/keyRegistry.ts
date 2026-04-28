import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type RegistryKeyStatus = "active" | "retired" | "revoked";

export type RegistryKey = {
  key_id: string;
  alg: "ed25519";
  public_key_spki_b64: string;
  status: RegistryKeyStatus;
  created_at: string;
  retired_at?: string;
  revoked_at?: string;
  note?: string;
};

export type KeyRegistry = {
  registry_version: "v1";
  updated_at: string;
  keys: RegistryKey[];
  policy: {
    allow_embedded_pubkey_fallback: boolean;
    accept_if_key_status: RegistryKeyStatus[];
    allow_signatures_before_revoke_at: boolean;
    require_key_id_match: boolean;
  };
};

function fail(msg: string): never {
  throw new Error(`[K2.12] ${msg}`);
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

export function canonicalizeRegistry(raw: KeyRegistry): KeyRegistry {
  if (raw.registry_version !== "v1") fail("registry_version must be v1");
  if (!isIsoDateString(raw.updated_at)) fail("updated_at must be ISO UTC date");
  if (!Array.isArray(raw.keys)) fail("keys must be array");
  if (!raw.policy) fail("policy is required");

  const keys = [...raw.keys]
    .map((key) => {
      if (!key || typeof key !== "object") fail("invalid key entry");
      if (typeof key.key_id !== "string" || !key.key_id.trim()) fail("key_id is required");
      if (key.alg !== "ed25519") fail(`unsupported alg for key ${key.key_id}`);
      if (typeof key.public_key_spki_b64 !== "string" || !key.public_key_spki_b64.trim()) {
        fail(`public_key_spki_b64 is required for key ${key.key_id}`);
      }
      if (!["active", "retired", "revoked"].includes(key.status)) {
        fail(`invalid status for key ${key.key_id}`);
      }
      if (!isIsoDateString(key.created_at)) fail(`created_at must be ISO UTC for key ${key.key_id}`);
      if (key.retired_at != null && !isIsoDateString(key.retired_at)) fail(`invalid retired_at for key ${key.key_id}`);
      if (key.revoked_at != null && !isIsoDateString(key.revoked_at)) fail(`invalid revoked_at for key ${key.key_id}`);

      return {
        key_id: key.key_id,
        alg: "ed25519" as const,
        public_key_spki_b64: key.public_key_spki_b64,
        status: key.status as RegistryKeyStatus,
        created_at: key.created_at,
        retired_at: key.retired_at,
        revoked_at: key.revoked_at,
        note: key.note,
      };
    })
    .sort((a, b) => a.key_id.localeCompare(b.key_id));

  for (let i = 1; i < keys.length; i += 1) {
    if (keys[i].key_id === keys[i - 1].key_id) {
      fail(`duplicate key_id: ${keys[i].key_id}`);
    }
  }

  const accept = Array.isArray(raw.policy.accept_if_key_status)
    ? [...raw.policy.accept_if_key_status].filter((v): v is RegistryKeyStatus =>
        v === "active" || v === "retired" || v === "revoked")
    : [];
  if (!accept.length) fail("policy.accept_if_key_status must contain at least one status");

  return {
    registry_version: "v1",
    updated_at: raw.updated_at,
    keys,
    policy: {
      allow_embedded_pubkey_fallback: Boolean(raw.policy.allow_embedded_pubkey_fallback),
      accept_if_key_status: accept,
      allow_signatures_before_revoke_at: Boolean(raw.policy.allow_signatures_before_revoke_at),
      require_key_id_match: Boolean(raw.policy.require_key_id_match),
    },
  };
}

export function canonicalRegistryString(registry: KeyRegistry): string {
  const c = canonicalizeRegistry(registry);
  return JSON.stringify(c);
}

export function registryDigest(registry: KeyRegistry): string {
  return sha256Hex(canonicalRegistryString(registry));
}

export function loadRegistry(registryPath?: string): { registry: KeyRegistry; digest_sha256: string; path: string } {
  const resolved = path.resolve(process.cwd(), registryPath || "scripts/telecore-key-registry.k2.12.json");
  if (!fs.existsSync(resolved)) fail(`registry file not found: ${resolved}`);
  const raw = JSON.parse(fs.readFileSync(resolved, "utf8")) as KeyRegistry;
  const registry = canonicalizeRegistry(raw);
  return {
    registry,
    digest_sha256: registryDigest(registry),
    path: resolved,
  };
}
