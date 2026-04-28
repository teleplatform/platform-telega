import type { WebExecuteInput, WebExecuteResult, WebProvider, WebProviderHealth } from '../web-provider.types';

export async function getOpenAIExtensionHealth(
  provider: WebProvider
): Promise<WebProviderHealth> {
  if (provider !== 'chatgpt_web') {
    return {
      provider,
      transport: 'extension',
      ready: false,
      reason: 'unsupported_extension_provider',
    };
  }

  return {
    provider: 'chatgpt_web',
    transport: 'extension',
    ready: true,
  };
}

export async function executeOpenAIExtensionPrompt(
  input: WebExecuteInput
): Promise<WebExecuteResult> {
  const startTime = Date.now();

  if (input.provider !== 'chatgpt_web') {
    return {
      ok: false,
      provider: input.provider,
      transport: 'extension',
      reason: 'unsupported_extension_provider',
      duration_ms: Date.now() - startTime,
    };
  }

  const timeoutMs = input.timeoutMs ?? 60000;

  try {
    const result = await sendAndWaitForResponse(input.prompt, timeoutMs);

    return {
      ok: result.ok,
      provider: 'chatgpt_web',
      transport: 'extension',
      responseText: result.text,
      reason: result.reason,
      duration_ms: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      ok: false,
      provider: 'chatgpt_web',
      transport: 'extension',
      reason: error.message,
      duration_ms: Date.now() - startTime,
    };
  }
}

interface SendResult {
  ok: boolean;
  method?: string;
  reason?: string;
}

interface ResponseResult {
  ok: boolean;
  text?: string;
  reason?: string;
}

async function sendAndWaitForResponse(prompt: string, timeoutMs: number): Promise<{ ok: boolean; text?: string; reason?: string }> {
  const pending = new Map<string, (payload: unknown) => void>();

  const messageHandler = (e: MessageEvent) => {
    if (e.data?.source !== 'telegpt-content') return;
    
    if (e.data.type === 'TELEGPT_SEND_PROMPT_RESULT') {
      pending.get('send')?.(e.data.payload);
    }
    if (e.data.type === 'TELEGPT_GET_RESPONSE_RESULT') {
      pending.get('response')?.(e.data.payload);
    }
  };

  window.addEventListener('message', messageHandler);

  return new Promise<{ ok: boolean; text?: string; reason?: string }>((resolve) => {
    pending.set('send', (payload) => {
      const sendResult = payload as SendResult;
      
      if (!sendResult.ok) {
        pending.delete('send');
        resolve({ ok: false, reason: sendResult.reason });
        return;
      }

      const startWait = Date.now();
      const checkInterval = setInterval(() => {
        if (Date.now() - startWait >= timeoutMs) {
          clearInterval(checkInterval);
          pending.delete('response');
          resolve({ ok: false, reason: 'response_timeout' });
        }
      }, 1000);

      pending.set('response', (payload) => {
        clearInterval(checkInterval);
        const responseResult = payload as ResponseResult;
        resolve(responseResult);
      });
    });

    window.postMessage({
      source: 'telegpt-page',
      type: 'TELEGPT_SEND_PROMPT',
      text: prompt,
    }, '*');

    setTimeout(() => {
      if (pending.has('send')) {
        pending.delete('send');
        resolve({ ok: false, reason: 'extension_not_responding' });
      }
    }, 5000);
  }).finally(() => {
    window.removeEventListener('message', messageHandler);
  });
}