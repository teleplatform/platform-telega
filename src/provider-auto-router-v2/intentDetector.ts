import type { ProviderIntent } from "./types.js";

const INTENT_PATTERNS: Array<{ intent: ProviderIntent; patterns: RegExp[] }> = [
  {
    intent: "fast_chat",
    patterns: [
      /^(hi|hello|hey|привет|здравствуй|дарова|ку|хай|здарова)\b/i,
      /^(как дела|how are you|what's up|чё как|нормально)\b/i,
      /^(ok|ок|ладно|хорошо|thanks|спасибо|ага|да|нет)\b/i,
      /^(test|тест|check|проверка)\b/i,
      /^[?.!]*$/,
      /(привет|прив|дарова|здарова|hello|hi)[\s\S]{0,50}$/i,
    ],
  },
  {
    intent: "code_small",
    patterns: [
      /напиши\s+(небольшой|маленький|простой|короткий)\s+(скрипт|код|функци)/i,
      /write\s+a\s+(small|simple|short|basic)\s+(script|code|function)/i,
      /сделай\s+(небольшой|маленький)\s+(скрипт|код)/i,
      /bash\s+(one.liner|one-liner)/i,
      /^(как|how\s+to)\s+(сделать|write|create|написать)\s+(маленький|small)/i,
    ],
  },
  {
    intent: "code_large",
    patterns: [
      /напиши\s+(большой|сложный|многофункциональный|полный|развёрнутый)\s+(скрипт|код|программ)/i,
      /write\s+a\s+(large|big|complex|full|comprehensive)\s+(script|code|program|application)/i,
      /создай\s+(полноценный|большой|комплексный)\s+(проект|приложени)/i,
      /(напиши|сделай)\s+(telegram.bot|веб.приложени|web.app|cli.tool)\s+(на|on)\s+(python|node|go|rust)/i,
    ],
  },
  {
    intent: "long_text",
    patterns: [
      /(напиши|написать|write|create)\s+(статью|article|пост|post|письм|letter|report|отчёт|доклад|сочинени|essay)\s+(на|of)\s+\d{3,}/i,
      /(напиши|написать)\s+(текст|рассказ|story)\s+(на|of)\s+\d{4,}/i,
      /(переведи|translate)\s+(большой|large|длинный|long)\s+(текст|text)/i,
    ],
  },
  {
    intent: "reasoning",
    patterns: [
      /(разбери|analyze|analyse|проанализируй|объясни|explain)\s+(архитектур|architecture|структур|structure|алгоритм|algorithm)/i,
      /(почему|why|how\s+does|как\s+работает)\s+(это|this|эта|этот).*(работает|works|сломалось|broken|failed)/i,
      /(найди|find|определи|identify)\s+(слабые|weak|проблем|problem|узкие|bottleneck)/i,
      /(сравни|compare|contrast)\s+(архитектур|approach|подход|решение|solution)/i,
      /разбери\s+(код|code|архитектуру|архитектура)/i,
    ],
  },
  {
    intent: "creative",
    patterns: [
      /(напиши|write|create|сочини|придумай)\s+(стих|poem|песн|song|истори|story|сказк|tale)/i,
      /(придумай|generate|сгенерируй)\s+(иде|idea|концепци|concept|названи|name)/i,
      /(нарисуй|draw|design|спроектируй)\s+(словами|in.words)/i,
    ],
  },
  {
    intent: "technical_debug",
    patterns: [
      /(почему|why|what.caused|что.пошло)\s+(не\s+работает|not.working|сломалось|broken|error|ошибк)/i,
      /(ошибк|error|exception|traceback|stack.trace)/i,
      /(debug|отлад|дебаг|fix|почини|исправь)/i,
      /(помоги|help|не\s+работает|doesn't.work|broken|crashed)/i,
    ],
  },
];

export function detectIntent(message: string): ProviderIntent {
  const lower = message.trim();
  for (const entry of INTENT_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(lower)) return entry.intent;
    }
  }
  return "unknown";
}
