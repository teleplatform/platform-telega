(function () {
  function getProvider() {
    const host = location.hostname;
    if (host.includes('chatgpt.com') || host.includes('openai.com')) return 'openai_web';
    if (host.includes('qwen.ai')) return 'qwen_web';
    if (host.includes('deepseek.com')) return 'deepseek_web';
    return 'unknown';
  }

  function findInput() {
    return (
      document.querySelector('#prompt-textarea') ||
      document.querySelector('div.ProseMirror#prompt-textarea') ||
      document.querySelector('div.ProseMirror[contenteditable="true"]') ||
      document.querySelector('[contenteditable="true"]')
    );
  }

  function setInputValue(input, text) {
    input.focus();

    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      const proto = Object.getPrototypeOf(input);
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      const setter = descriptor && descriptor.set;

      if (setter) setter.call(input, text);
      else input.value = text;

      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: text
      }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    if (input.getAttribute('contenteditable') === 'true') {
      input.focus();
      document.execCommand('insertText', false, text);
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: text
      }));
      return true;
    }

    return false;
  }

  function findStrictSendButton() {
    return (
      document.querySelector('#composer-submit-button') ||
      document.querySelector('button[data-testid="send-button"]') ||
      document.querySelector('button[aria-label="Send prompt"]') ||
      document.querySelector('button[aria-label="Send message"]') ||
      document.querySelector('button[aria-label="Отправить сообщение"]') ||
      document.querySelector('button[aria-label="Отправить запрос"]')
    );
  }

  function sendPrompt(text) {
    const input = findInput();
    if (!input) {
      return { ok: false, reason: 'no_input' };
    }

    const valueOk = setInputValue(input, text);
    if (!valueOk) {
      return { ok: false, reason: 'set_input_failed' };
    }

    const sendButton = findStrictSendButton();
    if (!sendButton) {
      return { ok: false, reason: 'send_button_not_found' };
    }

    if (sendButton.disabled || sendButton.getAttribute('aria-disabled') === 'true') {
      return { ok: false, reason: 'send_button_disabled' };
    }

    sendButton.click();

    return {
      ok: true,
      method: 'strict_send_button_click'
    };
  }

  function getAssistantMessages() {
    const selectors = [
      '[data-message-author-role="assistant"]',
      '[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]',
      'article [data-message-author-role="assistant"]',
      'main article'
    ];

    for (const selector of selectors) {
      const nodes = Array.from(document.querySelectorAll(selector))
        .map((el) => (el.innerText || '').trim())
        .filter(Boolean);

      if (nodes.length) return nodes;
    }

    return [];
  }

  function getLastAssistantMessage() {
    const messages = getAssistantMessages();
    return messages.length ? messages[messages.length - 1] : null;
  }

  function isAssistantStreaming() {
    const text = document.body?.innerText || '';
    return (
      text.includes('Stop generating') ||
      text.includes('Остановить генерацию') ||
      !!document.querySelector('button[data-testid="stop-button"]')
    );
  }

  async function waitForAssistantResponse(timeoutMs = 60000, stableMs = 2500) {
    const startedAt = Date.now();
    let lastText = '';
    let lastChangeAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const current = getLastAssistantMessage() || '';

      if (current !== lastText) {
        lastText = current;
        lastChangeAt = Date.now();
      }

      const streaming = isAssistantStreaming();

      if (current && !streaming && Date.now() - lastChangeAt >= stableMs) {
        return {
          ok: true,
          text: current
        };
      }

      await new Promise((resolve) => setTimeout(resolve, 700));
    }

    return {
      ok: false,
      reason: 'response_timeout',
      text: getLastAssistantMessage() || ''
    };
  }

  function getPageState() {
    const text = document.body?.innerText || '';
    const input = findInput();

    const challenge =
      text.includes('Verify you are human') ||
      text.includes('Подтвердите, что вы человек') ||
      text.includes('Cloudflare');

    const login =
      text.includes('Log in') ||
      text.includes('Sign in') ||
      text.includes('Continue with Google') ||
      text.includes('Войти');

    return {
      provider: getProvider(),
      url: location.href,
      title: document.title,
      input: !!input,
      login,
      challenge,
      ready: !!input && !login && !challenge
    };
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'telegpt-page') return;

    if (event.data.type === 'TELEGPT_PING') {
      window.postMessage({
        source: 'telegpt-content',
        type: 'TELEGPT_PING_RESULT',
        payload: { ok: true, provider: getProvider() }
      }, '*');
      return;
    }

    if (event.data.type === 'TELEGPT_STATE') {
      window.postMessage({
        source: 'telegpt-content',
        type: 'TELEGPT_STATE_RESULT',
        payload: getPageState()
      }, '*');
      return;
    }

    if (event.data.type === 'TELEGPT_SEND_PROMPT') {
      const result = sendPrompt(event.data.text || '');
      window.postMessage({
        source: 'telegpt-content',
        type: 'TELEGPT_SEND_PROMPT_RESULT',
        payload: result
      }, '*');
      return;
    }

    if (event.data.type === 'TELEGPT_GET_RESPONSE') {
      const result = await waitForAssistantResponse(
        event.data.timeoutMs || 60000,
        event.data.stableMs || 2500
      );

      window.postMessage({
        source: 'telegpt-content',
        type: 'TELEGPT_GET_RESPONSE_RESULT',
        payload: result
      }, '*');
    }
  });

  console.log('[TeleGPT Extension] content-script loaded:', getProvider());
})();