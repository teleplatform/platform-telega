export interface RemoteExecuteRequest {
  workerId: string;
  nodeId: string;
  taskType: string;
  capability: string;
  params: Record<string, unknown>;
  contractId: string | null;
  authToken: string;
}

export interface RemoteExecuteResponse {
  ok: boolean;
  output: unknown;
  evidence: string | null;
  durationMs: number;
  error: string | null;
}

export interface RemoteHeartbeatRequest {
  workerId: string;
  authToken: string;
  activeTasks: number;
  maxTasks: number;
  errorsSinceLast: number;
}

export interface RemoteHeartbeatResponse {
  ok: boolean;
  status: string;
  timestamp: number;
}

export interface RemoteEvidenceRequest {
  workerId: string;
  authToken: string;
  evidenceRecords: Array<{ evidenceId: string; taskType: string; output: unknown; durationMs: number }>;
}

export interface RemoteEvidenceResponse {
  ok: boolean;
  accepted: number;
}

export interface RemoteTransportConfig {
  baseUrl: string;
  authToken: string;
  timeoutMs: number;
  retryCount: number;
}

const DEFAULT_CONFIG: Pick<RemoteTransportConfig, 'timeoutMs' | 'retryCount'> = {
  timeoutMs: 30000,
  retryCount: 2
};

export function createTransportConfig(baseUrl: string, authToken: string, overrides?: Partial<RemoteTransportConfig>): RemoteTransportConfig {
  return { baseUrl, authToken, ...DEFAULT_CONFIG, ...overrides };
}

export async function sendExecuteRequest(config: RemoteTransportConfig, req: RemoteExecuteRequest): Promise<RemoteExecuteResponse> {
  return sendWithRetry(config, 'execute', req, config.retryCount);
}

export async function sendHeartbeatRequest(config: RemoteTransportConfig, req: RemoteHeartbeatRequest): Promise<RemoteHeartbeatResponse> {
  return sendWithRetry(config, 'heartbeat', req, config.retryCount);
}

export async function sendEvidenceRequest(config: RemoteTransportConfig, req: RemoteEvidenceRequest): Promise<RemoteEvidenceResponse> {
  return sendWithRetry(config, 'evidence', req, config.retryCount);
}

async function sendWithRetry(config: RemoteTransportConfig, endpoint: string, body: unknown, retriesLeft: number): Promise<any> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/worker/v1/${endpoint}`;

  for (let attempt = 0; attempt <= retriesLeft; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.authToken}`,
          'X-Worker-Id': (body as any)?.workerId ?? 'unknown'
        },
        body: JSON.stringify({ ...body as any, authToken: config.authToken }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        return { ok: false, output: null, evidence: null, durationMs: 0, error: `HTTP ${response.status}: ${text}` };
      }

      return await response.json();
    } catch (err: any) {
      if (attempt < retriesLeft) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      return { ok: false, output: null, evidence: null, durationMs: 0, error: `Transport error: ${err.message}` };
    }
  }
}

// ===== Remote Worker HTTP Server Handler =====
// For the runtime that hosts remote workers

export interface RemoteWorkerServerHandlers {
  execute: (req: RemoteExecuteRequest) => Promise<RemoteExecuteResponse>;
  heartbeat: (req: RemoteHeartbeatRequest) => Promise<RemoteHeartbeatResponse>;
  evidence: (req: RemoteEvidenceRequest) => Promise<RemoteEvidenceResponse>;
}

export function handleRemoteWorkerRequest(endpoint: string, body: any, handlers: RemoteWorkerServerHandlers): Promise<any> {
  switch (endpoint) {
    case 'execute': return handlers.execute(body);
    case 'heartbeat': return handlers.heartbeat(body);
    case 'evidence': return handlers.evidence(body);
    default: return Promise.resolve({ ok: false, error: `Unknown endpoint: ${endpoint}` });
  }
}
