/**
 * TGR-6.44 — Speech Style Registry
 * Defines how text should be transformed before TTS for better UX.
 */

export type SpeechStyleId =
  | "standard"
  | "technical"
  | "friendly"
  | "expressive"
  | "alice"
  | "teacher"
  | "narrator";

export interface SpeechStyleProfile {
  id: SpeechStyleId;
  label: string;
  emoji: string;
  description: string;
  rules: string[];
  systemPrompt: string;
}

export const SPEECH_STYLE_PROFILES: SpeechStyleProfile[] = [
  {
    id: "standard",
    label: "Стандартный",
    emoji: "💬",
    description: "Обычный текст без специальной обработки.",
    rules: [],
    systemPrompt: "Keep the text as is, ensure it is grammatically correct for speech.",
  },
  {
    id: "technical",
    label: "Технический",
    emoji: "💻",
    description: "Точный, сухой, профессиональный язык.",
    rules: ["использовать термины", "коротко и по делу", "без лишних эмоций"],
    systemPrompt: "Rewrite the text to be precise, technical, and professional. Avoid fluff.",
  },
  {
    id: "friendly",
    label: "Дружелюбный",
    emoji: "😊",
    description: "Теплый, поддерживающий тон.",
    rules: ["использовать вежливые обороты", "поддерживать пользователя", "мягкие интонации"],
    systemPrompt: "Rewrite the text to be warm, friendly, and supportive. Use conversational language.",
  },
  {
    id: "expressive",
    label: "Экспрессивный",
    emoji: "🎭",
    description: "Живой, эмоциональный, с богатой лексикой.",
    rules: ["выразительные слова", "восклицания", "разнообразный темп"],
    systemPrompt: "Rewrite the text to be emotionally expressive and lively. Use vivid language.",
  },
  {
    id: "alice",
    label: "Alice-like",
    emoji: "🟣",
    description: "Естественный, человечный, живой диалог.",
    rules: [
      "короткие предложения",
      "живые переходы",
      "естественные паузы",
      "объяснение человеческим языком",
      "дружелюбный тон",
    ],
    systemPrompt: `Твоя задача — переписать текст ответа для голосового ассистента, чтобы он звучал максимально естественно, как человек.
ПРАВИЛА:
1. Используй короткие, понятные предложения.
2. Добавляй живые переходы («Смотри...», «Понимаешь,», «Кстати,»).
3. Говори простым человеческим языком, избегай канцеляризмов и сложных терминов.
4. Тон должен быть дружелюбным и легким.
5. Если в тексте ошибка, не говори «Произошла ошибка», скажи «Ой, что-то пошло не так, давай попробуем еще раз».
6. Обязательно сохраняй смысл исходного сообщения.`,
  },
  {
    id: "teacher",
    label: "Учитель",
    emoji: "👨‍🏫",
    description: "Терпеливый, структурированный, обучающий.",
    rules: ["пошаговые инструкции", "терпеливый тон", "акцент на понимании"],
    systemPrompt: "Rewrite the text to be patient and educational. Structure it as a clear explanation.",
  },
  {
    id: "narrator",
    label: "Рассказчик",
    emoji: "📖",
    description: "Повествовательный, плавный, увлекательный.",
    rules: ["плавные переходы", "увлекательный ритм", "описательный стиль"],
    systemPrompt: "Rewrite the text as a smooth, engaging narrative. Use a storytelling pace.",
  },
];

export function getSpeechStyle(id: SpeechStyleId): SpeechStyleProfile {
  return SPEECH_STYLE_PROFILES.find((p) => p.id === id) || SPEECH_STYLE_PROFILES[0];
}

export function listSpeechStyles(): SpeechStyleProfile[] {
  return SPEECH_STYLE_PROFILES;
}
