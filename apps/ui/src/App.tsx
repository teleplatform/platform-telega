import { useState, useEffect, useRef, useLayoutEffect } from "react";

interface Model {
  id: string;
  object: string;
  owned_by: string;
  title?: string;
}

interface ModelsResponse {
  object: string;
  data: Model[];
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  meta?: ChatResponse["meta"];
}

interface ChatResponse {
  id: string;
  model: string;
  output: string;
  meta?: {
    request_id: string;
    provider: string;
    model_raw: string;
    model_resolved: string;
    ts: number;
    latency_ms: number;
  };
}

function App() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem("telegpt.selectedModel") || "local-demo";
  });
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [userMessage, setUserMessage] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const [lastFailed, setLastFailed] = useState<null | { requestId: string; text: string }>(null);
  const [inputFocused, setInputFocused] = useState<boolean>(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const openaiMissingNotifiedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const lastToastRef = useRef<string | null>(null);
  const hasOpenAIModels = models.some((m) => m.id.startsWith("openai:"));

  const renderAssistantMeta = (msg: ChatMessage) => {
    if (msg.role !== "assistant") return null;

    const rid = msg.meta?.request_id;
    const ridShort = rid
      ? rid.startsWith("req_")
        ? `req_${rid.slice(4, 12)}`
        : rid.slice(0, 10)
      : null;

    const provider = msg.meta?.provider;
    const latency =
      typeof msg.meta?.latency_ms === "number" ? `${msg.meta.latency_ms}ms` : null;

    const showMeta = !!ridShort || !!provider || !!latency;
    if (!showMeta) return null;

    return (
      <div style={{ marginTop: "6px", fontSize: "12px", opacity: 0.7 }}>
        {ridShort ?? ""}
        {provider ? ` • ${provider}` : ""}
        {latency ? ` • ${latency}` : ""}
      </div>
    );
  };

  const showToast = (msg: string) => {
    if (lastToastRef.current === msg) return;
    lastToastRef.current = msg;
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
      lastToastRef.current = null;
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!toast) return;
      setToast(null);
      lastToastRef.current = null;
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toast]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try { await fetch("/v1/models", { cache: "no-store" }); if (!stop) setBackendOnline(true); }
      catch { if (!stop) setBackendOnline(false); }
    };
    tick();
    const id = window.setInterval(tick, 3000);
    return () => { stop = true; window.clearInterval(id); };
  }, []);

  // Загрузка моделей при онлайне бекенда
  useEffect(() => {
    if (backendOnline === false) return;
    fetch("/v1/models")
      .then((res) => res.json())
      .then((data: ModelsResponse) => {
        setModels(data.data);
        setError("");
        if (data.data.length > 0) {
          const stored = localStorage.getItem("telegpt.selectedModel");
          const exists = stored && data.data.some((m) => m.id === stored);
          const next = exists ? stored! : data.data[0].id;
          if (stored?.startsWith("openai:") && !exists) {
            if (!openaiMissingNotifiedRef.current) {
              openaiMissingNotifiedRef.current = true;
              showToast("OpenAI недоступен (нет ключа) — переключено на Local");
            }
          } else if (exists) {
            openaiMissingNotifiedRef.current = false;
          }
          setSelectedModel(next);
        }
      })
      .catch((err) => {
        console.error("Failed to load models:", err);
        setError("Не удалось загрузить список моделей");
      });
  }, [backendOnline]);

  useEffect(() => {
    localStorage.setItem("telegpt.selectedModel", selectedModel);
  }, [selectedModel]);

  useLayoutEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [userMessage]);

  const handleSendMessage = async (
    forcedRequestId?: string,
    forcedMessage?: string,
    retryOnce = false
  ) => {
    if (isLoading) return;
    const messageText = forcedMessage ?? userMessage;
    if (!messageText.trim()) return;

    setIsLoading(true);
    chatAbortRef.current?.abort();

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: messageText },
    ];
    setMessages(newMessages);

    let timedOut = false;
    const ac = new AbortController();
    chatAbortRef.current = ac;
    const t = window.setTimeout(() => {
      timedOut = true;
      ac.abort();
    }, 15000);

    const requestId = forcedRequestId ?? crypto.randomUUID();
    try {
      const response = await fetch("/v1/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": requestId,
        },
        body: JSON.stringify({
          model: selectedModel,
          system: systemPrompt,
          message: messageText,
        }),
        signal: ac.signal,
      });

      if (response.status === 429 && !retryOnce) {
        const raMs = Number(response.headers.get("x-retry-after-ms") ?? "0");
        const raSec = Number(response.headers.get("retry-after") ?? "1");
        const waitMs = raMs > 0 ? raMs : Math.max(0, raSec) * 1000;
        showToast("Сервер занят — пробую ещё раз…");
        await new Promise((r) => setTimeout(r, waitMs));
        return handleSendMessage(requestId, messageText, true);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ChatResponse = await response.json();

      setMessages([
        ...newMessages,
        { role: "assistant", content: data.output ?? "", meta: data.meta },
      ]);
      setUserMessage("");
      setLastFailed(null);
      if (backendOnline !== false) inputRef.current?.focus();
    } catch (err) {
      console.error("Chat error:", err);
      if (err instanceof DOMException && err.name === "AbortError") {
        if (timedOut) {
          setLastFailed({ requestId, text: messageText });
          showToast(
            "Timeout: backend не ответил за 15s. Нажми на тост, чтобы повторить."
          );
        }
        return;
      }
      setLastFailed({ requestId, text: messageText });
      showToast("Не отправилось. Нажми на тост, чтобы повторить.");
    } finally {
      window.clearTimeout(t);
      if (chatAbortRef.current === ac) chatAbortRef.current = null;
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h1 style={{ marginBottom: "20px" }}>Tele•GPT</h1>
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        Backend: {backendOnline === null ? "…" : backendOnline ? "online" : "offline"}
      </div>

      {error && (
        <div style={{ 
          background: "#ff4444", 
          color: "white", 
          padding: "10px", 
          borderRadius: "4px", 
          marginBottom: "20px" 
        }}>
          {error}{" "}
          <button
            onClick={() => setError("")}
            style={{ marginLeft: "10px", background: "transparent", color: "white", border: "1px solid white", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}
          >
            Очистить
          </button>
        </div>
      )}
      {toast && (
        <div
          onClick={() => {
            if (lastFailed) {
              const { requestId: rid, text } = lastFailed;
              setToast(null);
              lastToastRef.current = null;
              if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
              toastTimerRef.current = null;
              setLastFailed(null);
              handleSendMessage(rid, text);
              return;
            }
            setToast(null);
            lastToastRef.current = null;
            if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
          }}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: "fixed",
            left: "50%",
            bottom: "16px",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "8px 12px",
            borderRadius: "12px",
            fontSize: "12px",
            boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "8px" }}>
          Модель:
          {backendOnline === false ? (
            <span style={{ marginLeft: "10px", color: "#888" }}>
              Backend offline
            </span>
          ) : (
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                marginLeft: "10px",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #444",
                background: "#2a2a2a",
                color: "white",
                minWidth: "300px",
              }}
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.id.startsWith("openai:") ? "🟣 OpenAI • " : "⚫ Local • "}
                  {model.title || model.id}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => {
              localStorage.removeItem("telegpt.selectedModel");
              if (models.length > 0) setSelectedModel(models[0].id);
              setError("");
            }}
            disabled={backendOnline === false || models.length === 0}
            style={{
              marginLeft: 10,
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #444",
              background: "transparent",
              color: "white",
              cursor:
                backendOnline === false || models.length === 0
                  ? "not-allowed"
                  : "pointer",
              opacity: backendOnline === false || models.length === 0 ? 0.5 : 1,
            }}
          >
            Reset model
          </button>
          {!hasOpenAIModels && (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
              🟣 OpenAI недоступен (нет ключа OPENAI_API_KEY)
            </div>
          )}
        </label>

        <label style={{ display: "block", marginBottom: "8px" }}>
          Системный промпт:
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Опишите поведение ассистента..."
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #444",
              background: "#2a2a2a",
              color: "white",
              minHeight: "80px",
              marginTop: "8px",
            }}
          />
        </label>
      </div>

      <div
        ref={chatScrollRef}
        style={{
          background: "#2a2a2a",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "20px",
          minHeight: "300px",
          maxHeight: "500px",
          overflowY: "auto",
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: "#888" }}>Начните диалог...</p>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: "16px",
              padding: "12px",
              borderRadius: "8px",
              background: msg.role === "user" ? "#3a3a3a" : "#4a4a4a",
            }}
          >
            <strong>{msg.role === "user" ? "Вы" : "Ассистент"}:</strong>
            <p style={{ marginTop: "8px" }}>{msg.content}</p>
            {renderAssistantMeta(msg)}
          </div>
        ))}
        <div ref={chatEndRef} />
        {isLoading && <p style={{ color: "#888" }}>Думаю...</p>}
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <textarea
            ref={inputRef}
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!isLoading && backendOnline !== false) handleSendMessage();
              }
            }}
            placeholder={
              backendOnline === false ? "Backend offline..." : "Введите сообщение..."
            }
            disabled={isLoading || backendOnline === false}
            style={{
              flex: 1,
              padding: "12px",
              paddingRight: "52px",
              borderRadius: "4px",
              border: "1px solid #444",
              background: "#2a2a2a",
              color: "white",
              minHeight: "44px",
              resize: "none",
              overflow: "auto",
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={
              isLoading || backendOnline === false || !userMessage.trim()
            }
            style={{
              position: "absolute",
              right: 8,
              bottom: 8,
              width: 36,
              height: 36,
              borderRadius: 999,
              border: "1px solid #444",
              background: "transparent",
              color: "white",
              opacity:
                isLoading || backendOnline === false || !userMessage.trim()
                  ? 0.4
                  : 1,
              cursor:
                isLoading || backendOnline === false || !userMessage.trim()
                  ? "not-allowed"
                  : "pointer",
            }}
            title="Отправить (Enter)"
          >
            ➤
          </button>
          {inputFocused && userMessage.trim().length === 0 && (
            <div
              style={{
                position: "absolute",
                right: 52,
                bottom: 16,
                fontSize: 11,
                opacity: 0.55,
                pointerEvents: "none",
                color: "white",
              }}
            >
              Enter • Shift+Enter
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
