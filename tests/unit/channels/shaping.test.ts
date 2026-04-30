import { describe, it, expect } from "vitest";
import { shapeForAlice, getAliceFallback } from "../src/channels/response-shaper.js";
import type { UnifiedInboundEvent } from "../src/channels/unified-event.js";

describe("Response Shaping - Alice", () => {
  const baseEvent: UnifiedInboundEvent = {
    channel: "alice",
    trace_id: "test-trace-123",
    channel_user_id: "user1",
    channel_session_id: "alice:user1:sess1",
    message_id: "msg1",
    text: "привет",
    raw_payload: {},
    metadata: {},
  };

  it("should handle successful core response", () => {
    const coreData = {
      status: "ok",
      data: {
        message: "Привет! Я помогу вам с задачей.",
      },
    };

    const result = shapeForAlice(baseEvent, coreData);

    expect(result.response_type).toBe("immediate");
    expect(result.display_text).toBe("Привет! Я помогу вам с задачей.");
    expect(result.speak_text).toBe("Привет! Я помогу вам с задачей.");
  });

  it("should strip markdown from response", () => {
    const coreData = {
      status: "ok",
      data: {
        message: "Это **жирный** и *курсивный* текст",
      },
    };

    const result = shapeForAlice(baseEvent, coreData);

    expect(result.display_text).toBe("Это жирный и курсивный текст");
  });

  it("should handle error response", () => {
    const coreData = {
      status: "error",
      error: {
        message: "Что-то пошло не так",
      },
    };

    const result = shapeForAlice(baseEvent, coreData);

    expect(result.response_type).toBe("final");
    expect(result.display_text).toBe("Что-то пошло не так");
  });

  it("should truncate long responses", () => {
    const longText = "А".repeat(300);
    const coreData = {
      status: "ok",
      data: {
        message: longText,
      },
    };

    const result = shapeForAlice(baseEvent, coreData);

    expect(result.response_type).toBe("handoff");
    expect(result.display_text).toContain("слишком длинным");
  });

  it("should return fallback for upstream unavailable", () => {
    const result = getAliceFallback("upstream_unavailable", "test-trace");

    expect(result.response_type).toBe("final");
    expect(result.display_text).toContain("Не удалось связаться");
  });

  it("should return fallback for timeout", () => {
    const result = getAliceFallback("timeout", "test-trace");

    expect(result.response_type).toBe("final");
    expect(result.display_text).toContain("не успел ответить");
  });

  it("should return fallback for invalid response", () => {
    const result = getAliceFallback("invalid_response", "test-trace");

    expect(result.response_type).toBe("final");
    expect(result.display_text).toContain("некорректный ответ");
  });
});

describe("Session Mapping", () => {
  it("should generate stable Alice session key", () => {
    const userId = "user123";
    const sessionId = "sess456";

    const sessionKey = `alice:${userId}:${sessionId}`;

    expect(sessionKey).toBe("alice:user123:sess456");
  });

  it("should generate stable Telegram private session key", () => {
    const chatId = "chat123";
    const userId = "user456";

    const sessionKey = `tg:private:${chatId}:${userId}`;

    expect(sessionKey).toBe("tg:private:chat123:user456");
  });

  it("should generate stable Telegram group session key", () => {
    const chatId = "group789";
    const userId = "user111";

    const sessionKey = `tg:group:${chatId}:${userId}`;

    expect(sessionKey).toBe("tg:group:group789:user111");
  });
});

describe("Markdown Stripping", () => {
  it("should strip bold markers", () => {
    const text = "Это **жирный** текст";
    const result = text.replace(/[*_~`>#]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    expect(result).toBe("Это жирный текст");
  });

  it("should strip italic markers", () => {
    const text = "Это *курсивный* текст";
    const result = text.replace(/[*_~`>#]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    expect(result).toBe("Это курсивный текст");
  });

  it("should strip links", () => {
    const text = "Это [ссылка](https://example.com) текст";
    const result = text.replace(/[*_~`>#]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    expect(result).toBe("Это ссылка текст");
  });
});
