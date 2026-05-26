import crypto from 'node:crypto';

export interface HandshakePayload {
  runtimeId: string;
  timestamp: number;
  capabilities: string[];
  version: string;
}

export interface HandshakeResult {
  ok: boolean;
  remoteRuntimeId: string;
  remoteCapabilities: string[];
  remoteVersion: string;
  error?: string;
}

let sharedSecret: string = process.env.WORKER_FEDERATION_SECRET ?? 'sigma-forge-dev-secret';

export function setSharedSecret(secret: string): void {
  sharedSecret = secret;
}

export function getSharedSecret(): string {
  return sharedSecret;
}

export function generateAuthToken(payload: Record<string, unknown>): string {
  const data = typeof payload === 'string' ? payload : JSON.stringify(sortObject(payload));
  return crypto.createHmac('sha256', sharedSecret).update(data).digest('hex').slice(0, 32);
}

export function validateAuthToken(token: string, payload: Record<string, unknown>): boolean {
  const expected = generateAuthToken(payload);
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function createHandshake(runtimeId: string, capabilities: string[], version: string): { payload: HandshakePayload; token: string } {
  const payload: HandshakePayload = {
    runtimeId,
    timestamp: Date.now(),
    capabilities,
    version
  };
  const token = generateAuthToken(payload as unknown as Record<string, unknown>);
  return { payload, token };
}

export function verifyHandshake(payload: HandshakePayload, token: string): boolean {
  const nonce = { ...payload, _verified: Date.now() };
  return validateAuthToken(token, { ...payload as unknown as Record<string, unknown>, ...nonce });
}

export async function performHandshake(
  remoteUrl: string,
  localRuntimeId: string,
  localCapabilities: string[],
  localVersion: string
): Promise<HandshakeResult> {
  const { payload, token } = createHandshake(localRuntimeId, localCapabilities, localVersion);

  try {
    const response = await fetch(`${remoteUrl.replace(/\/$/, '')}/federation/v1/handshake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return { ok: false, remoteRuntimeId: '', remoteCapabilities: [], remoteVersion: '', error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return {
      ok: true,
      remoteRuntimeId: data.runtimeId ?? 'unknown',
      remoteCapabilities: data.capabilities ?? [],
      remoteVersion: data.version ?? 'unknown'
    };
  } catch (err: any) {
    return { ok: false, remoteRuntimeId: '', remoteCapabilities: [], remoteVersion: '', error: err.message };
  }
}

export function createAuthHeader(payload: Record<string, unknown>): string {
  return `Bearer ${generateAuthToken(payload)}`;
}

function sortObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key];
  }
  return sorted;
}
