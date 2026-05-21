import crypto from "node:crypto";

export function hashInput(input: unknown): string {
  return sha256(serialize(input));
}

export function hashOutput(output: unknown): string {
  return sha256(serialize(output));
}

export function hashArtifact(content: string | Buffer): string {
  const buf = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  return sha256(buf);
}

export function hashObject(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) {
    ordered[k] = obj[k];
  }
  return sha256(serialize(ordered));
}

export function hashTraceId(jobId: string, type: string): string {
  return sha256(`${jobId}:${type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`).slice(0, 16);
}

function sha256(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function serialize(value: unknown): Buffer {
  const str = typeof value === "string" ? value : JSON.stringify(value, Object.keys(value || {}).sort());
  return Buffer.from(str, "utf8");
}
