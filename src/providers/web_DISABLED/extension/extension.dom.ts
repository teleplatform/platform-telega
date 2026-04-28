export interface ExtensionBridgeSendResult {
  ok: boolean;
  method?: string;
  reason?: string;
}

export interface ExtensionBridgeResponseResult {
  ok: boolean;
  text?: string;
  reason?: string;
}

export interface ExtensionBridgeStateResult {
  provider: string;
  url: string;
  title: string;
  input: boolean;
  login: boolean;
  challenge: boolean;
  ready: boolean;
}

declare global {
  interface Window {
    __telegptBridgePending?: Map<string, (payload: unknown) => void>;
  }
}

function ensurePendingMap(): Map<string, (payload: unknown) => void> {
  if (!window.__telegptBridgePending) {
    window.__telegptBridgePending = new Map();
  }
  return window.__telegptBridgePending;
}

export function installExtensionBridgeListener() {
  const pending = ensurePendingMap();

  window.addEventListener('message', (e) => {
    if (e.data?.source !== 'telegpt-content') return;
    if (!e.data?.type) return;

    if (e.data.type === 'TELEGPT_SEND_PROMPT_RESULT') {
      pending.get('send')?.(e.data.payload);
    }

    if (e.data.type === 'TELEGPT_GET_RESPONSE_RESULT') {
      pending.get('response')?.(e.data.payload);
    }

    if (e.data.type === 'TELEGPT_STATE_RESULT') {
      pending.get('state')?.(e.data.payload);
    }
  });
}

export function sendPromptViaExtension(text: string): Promise<ExtensionBridgeSendResult> {
  const pending = ensurePendingMap();

  return new Promise((resolve) => {
    pending.set('send', (payload) => {
      pending.delete('send');
      resolve(payload as ExtensionBridgeSendResult);
    });

    window.postMessage({
      source: 'telegpt-page',
      type: 'TELEGPT_SEND_PROMPT',
      text,
    }, '*');
  });
}

export function getResponseViaExtension(timeoutMs = 60000, stableMs = 2500): Promise<ExtensionBridgeResponseResult> {
  const pending = ensurePendingMap();

  return new Promise((resolve) => {
    pending.set('response', (payload) => {
      pending.delete('response');
      resolve(payload as ExtensionBridgeResponseResult);
    });

    window.postMessage({
      source: 'telegpt-page',
      type: 'TELEGPT_GET_RESPONSE',
      timeoutMs,
      stableMs,
    }, '*');
  });
}

export function getStateViaExtension(): Promise<ExtensionBridgeStateResult> {
  const pending = ensurePendingMap();

  return new Promise((resolve) => {
    pending.set('state', (payload) => {
      pending.delete('state');
      resolve(payload as ExtensionBridgeStateResult);
    });

    window.postMessage({
      source: 'telegpt-page',
      type: 'TELEGPT_STATE',
    }, '*');
  });
}