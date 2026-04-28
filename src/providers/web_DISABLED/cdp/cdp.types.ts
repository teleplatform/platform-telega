export type WebProviderId = "chatgpt_web" | "qwen_web" | "deepseek_web";

export type SessionHealth =
  | "alive"
  | "login_required"
  | "challenge_detected"
  | "browser_unreachable"
  | "tab_missing";

export type ProviderTransport = "api" | "local" | "web_cdp";

export interface WebCDPProviderConfig {
  provider: WebProviderId;
  debugUrl: string;
  expectedHostnames: string[];
  sessionRequired: boolean;
  manualLoginOnly: boolean;
}

export interface CDPConnection {
  endpoint: string;
  browser: any;
  connected: boolean;
  connectedAt: number;
}

export interface CDPSession {
  id: string;
  provider: WebProviderId;
  state: SessionHealth;
  healthScore: number;
  enabled: boolean;
  lastCheck: number;
  lastError?: string;
  cooldownUntil?: number;
}

export interface CDPBrowserConfig {
  debugPort: number;
  profileDir?: string;
  headless?: boolean;
  timeoutMs?: number;
}

export interface CDPExecutionRequest {
  prompt: string;
  provider: WebProviderId;
  systemPrompt?: string;
  traceId: string;
}

export interface CDPExecutionResult {
  success: boolean;
  provider: WebProviderId;
  session_state: SessionHealth;
  submit_status?: "sent" | "failed";
  response_status?: "received" | "timeout" | "parse_failed";
  output_text?: string;
  error_code?: string;
  trace_id: string;
  evidence?: string[];
  duration_ms: number;
}

export interface WebAdapterConfig {
  providerId: WebProviderId;
  loginUrl: string;
  expectedHostname: string;
  inputSelector: string;
  submitSelector: string;
  outputSelector: string;
  loadingSelector: string;
  maxRetries: number;
}

export const PROVIDER_CONFIGS: Record<WebProviderId, WebAdapterConfig> = {
  chatgpt_web: {
    providerId: "chatgpt_web",
    loginUrl: "https://chatgpt.com",
    expectedHostname: "chatgpt.com",
    inputSelector: 'textarea[id="prompt-textarea"]',
    submitSelector: 'button[data-testid="send-button"]',
    outputSelector: '[data-message-author-role="assistant"]',
    loadingSelector: '[data-testid="stop-button"], .result-thinking',
    maxRetries: 3,
  },
  qwen_web: {
    providerId: "qwen_web",
    loginUrl: "https://qwen.ai",
    expectedHostname: "qwen.ai",
    inputSelector: 'textarea[placeholder*="输入"]',
    submitSelector: 'button[type="submit"]',
    outputSelector: '.assistant-message, [class*="response"]',
    loadingSelector: '.thinking, .loading',
    maxRetries: 3,
  },
  deepseek_web: {
    providerId: "deepseek_web",
    loginUrl: "https://chat.deepseek.com",
    expectedHostname: "chat.deepseek.com",
    inputSelector: 'textarea[name="prompt"]',
    submitSelector: 'button[type="submit"]',
    outputSelector: '.assistant-message, [class*="message"]',
    loadingSelector: '.thinking, .loading',
    maxRetries: 3,
  },
};

export const DEFAULT_CDP_PORT = 9222;

const customEndpoint = process.env.CDP_ENDPOINT;
let cdpBaseUrl = `http://127.0.0.1:${DEFAULT_CDP_PORT}`;

if (customEndpoint) {
  const urlMatch = customEndpoint.match(/^ws?:\/\/([^:\/]+)(?::(\d+))?/);
  if (urlMatch) {
    const host = urlMatch[1];
    const port = urlMatch[2] || DEFAULT_CDP_PORT;
    cdpBaseUrl = `http://${host}:${port}`;
  }
}

export const CDP_ENDPOINTS: Record<WebProviderId, string> = {
  chatgpt_web: cdpBaseUrl,
  qwen_web: cdpBaseUrl,
  deepseek_web: cdpBaseUrl,
};