export interface BenchmarkPrompt {
  id: string;
  label: string;
  prompt: string;
  category: "chat" | "code" | "reasoning" | "translation" | "summary";
  minExpectedLength: number;
  timeoutMs: number;
}

export const BENCHMARK_PROMPTS: BenchmarkPrompt[] = [
  {
    id: "chat_test",
    label: "Chat",
    prompt: "Ответь коротко в одном предложении: что такое TeleGPT?",
    category: "chat",
    minExpectedLength: 10,
    timeoutMs: 30000,
  },
  {
    id: "code_test",
    label: "Code",
    prompt: "Напиши функцию sum(a, b) на TypeScript с типами. Только код, без объяснений.",
    category: "code",
    minExpectedLength: 30,
    timeoutMs: 60000,
  },
  {
    id: "reasoning_test",
    label: "Reasoning",
    prompt: "Explain why a local STT engine is better than a cloud API for a voice assistant. Keep it under 100 words.",
    category: "reasoning",
    minExpectedLength: 30,
    timeoutMs: 60000,
  },
  {
    id: "translation_test",
    label: "Translation",
    prompt: "Переведи на английский: Я тату-мастер из Ташкента, делаю авторские работы уже 5 лет.",
    category: "translation",
    minExpectedLength: 10,
    timeoutMs: 30000,
  },
  {
    id: "summary_test",
    label: "Summary",
    prompt: "Summarize in one sentence: TeleGPT is a cognitive runtime with persistent memory, RAG knowledge, and multi-agent orchestration.",
    category: "summary",
    minExpectedLength: 10,
    timeoutMs: 30000,
  },
];

export const FAST_TEST_PROMPT: BenchmarkPrompt = {
  id: "fast_test",
  label: "Fast",
  prompt: "Say 'ok' if you are running.",
  category: "chat",
  minExpectedLength: 2,
  timeoutMs: 15000,
};
