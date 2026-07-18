import { appendEvidenceRecord } from "../runtime/evidence/execution-evidence-store.js";

export type IntentClass =
  | "quick_answer"
  | "code_generation"
  | "code_review"
  | "architecture"
  | "deep_research"
  | "web_research"
  | "creative"
  | "translation"
  | "summarization"
  | "reasoning"
  | "multi_opinion"
  | "local_private"
  | "unknown";

export interface IntentMatch {
  intent: IntentClass;
  confidence: number;
  matchedPatterns: string[];
}

export interface ProviderRecommendation {
  intent: IntentClass;
  primary: string;
  fallbacks: string[];
  reason: string;
}

const INTENT_PATTERNS: Record<IntentClass, RegExp[]> = {
  quick_answer: [/quick|fast|rapid|instant|short|brief|tl;dr|вкратце|быстро|коротко/i],
  code_generation: [/write.*(code|function|class|script|program|app|component|module|api|endpoint)|generate.*code|create.*(function|class|script)|implement|напиши.*код|создай.*(функцию|класс)|реализуй/i],
  code_review: [/review.*code|code.*review|refactor|оптимизируй|рефакторинг|code.*quality|найди.*(баг|ошибку)/i],
  architecture: [/architecture|design.*(system|pattern|architecture)|архитектура|спроектируй|how.*(design|structure|architect)/i],
  deep_research: [/research|investigate|analyze.*(deep|thorough|comprehensive)|глубокий.*анализ|исследуй|разбери/i],
  web_research: [/search|find|look.*up|what.*(is|are)|who.*is|latest|news|current|последний|новости|найди|поищи/i],
  creative: [/write.*(story|poem|essay|article|post)|create.*(story|content)|creative|напиши.*(рассказ|стих|эссе|пост)|креатив/i],
  translation: [/translate|переведи|translation|перевод/i],
  summarization: [/summarize|summary|summarize|резюмируй|саммари|краткое.*содержание/i],
  reasoning: [/why|explain|reason|thinking|почему|объясни|рассуждай|logical|logic|math|problem.*solving/i],
  multi_opinion: [/compare|debate|consensus|multiple.*(opinion|view|perspective)|сравни|разные.*мнения|совет.*директоров|advisor/i],
  local_private: [/local.*only|offline|no.*internet|private|secure|confidential|локально|офлайн|без.*интернета/i],
  unknown: [],
};

const INTENT_PROVIDER_MAP: Record<IntentClass, ProviderRecommendation> = {
  quick_answer: {
    intent: "quick_answer",
    primary: "local",
    fallbacks: ["kimi_local_web_api", "glm_local_web_api", "deepseek_web"],
    reason: "lowest latency, no auth needed",
  },
  code_generation: {
    intent: "code_generation",
    primary: "kimi_local_web_api",
    fallbacks: ["kimi_api", "deepseek_web", "openai_api", "local"],
    reason: "Kimi strong at code, browser fallback available",
  },
  code_review: {
    intent: "code_review",
    primary: "deepseek_web",
    fallbacks: ["kimi_local_web_api", "glm_local_web_api", "openai_api"],
    reason: "DeepSeek best for code analysis",
  },
  architecture: {
    intent: "architecture",
    primary: "openai_api",
    fallbacks: ["kimi_api", "glm_local_web_api", "multi_opinion"],
    reason: "architecture benefits from broad reasoning, Kimi K3 for long-context planning",
  },
  deep_research: {
    intent: "deep_research",
    primary: "glm_local_web_api",
    fallbacks: ["kimi_api", "glm_api", "kimi_local_web_api", "deepseek_web"],
    reason: "GLM search models excel at deep research, Kimi K3 for long-context research",
  },
  web_research: {
    intent: "web_research",
    primary: "kimi_local_web_api",
    fallbacks: ["glm_local_web_api", "deepseek_web", "openai_api"],
    reason: "Kimi good for research, GLM search as fallback",
  },
  creative: {
    intent: "creative",
    primary: "openai_api",
    fallbacks: ["kimi_local_web_api", "glm_local_web_api", "mimo_api"],
    reason: "OpenAI best for creative, Kimi/GLM as fallback",
  },
  translation: {
    intent: "translation",
    primary: "glm_local_web_api",
    fallbacks: ["kimi_local_web_api", "openai_api", "local"],
    reason: "GLM strong multilingual",
  },
  summarization: {
    intent: "summarization",
    primary: "kimi_local_web_api",
    fallbacks: ["glm_local_web_api", "deepseek_web", "local"],
    reason: "Kimi excels at long-context summarization",
  },
  reasoning: {
    intent: "reasoning",
    primary: "deepseek_web",
    fallbacks: ["kimi_api", "glm_local_web_api", "kimi_local_web_api", "openai_api"],
    reason: "DeepSeek strongest at reasoning and logic, Kimi K3 for always-on reasoning",
  },
  multi_opinion: {
    intent: "multi_opinion",
    primary: "multi_opinion",
    fallbacks: ["kimi_local_web_api", "glm_local_web_api", "deepseek_web", "openai_api"],
    reason: "multi-provider advisor mode for diverse perspectives",
  },
  local_private: {
    intent: "local_private",
    primary: "local",
    fallbacks: [],
    reason: "user requested local-only, no external providers",
  },
  unknown: {
    intent: "unknown",
    primary: "kimi_local_web_api",
    fallbacks: ["glm_local_web_api", "deepseek_web", "local"],
    reason: "default — Kimi for general purpose",
  },
};

function recordEvidence(type: string, payload: Record<string, unknown>): void {
  appendEvidenceRecord({
    evidence_id: `intent-${type}-${Date.now()}`,
    trace_id: "intent",
    job_id: "provider_intelligence",
    type: type as any,
    timestamp: new Date().toISOString(),
    payload,
  }).catch(() => {});
}

export const ProviderIntelligence = {
  classify(message: string): IntentMatch {
    const results: Array<{ intent: IntentClass; matches: string[] }> = [];

    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      if (intent === "unknown") continue;
      const matches: string[] = [];
      for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) matches.push(match[0]);
      }
      if (matches.length > 0) {
        results.push({ intent: intent as IntentClass, matches });
      }
    }

    if (results.length === 0) {
      return { intent: "unknown", confidence: 0.3, matchedPatterns: [] };
    }

    // Sort by most matched patterns
    results.sort((a, b) => b.matches.length - a.matches.length);
    const best = results[0];

    // Check for multi_opinion override
    if (results.some(r => r.intent === "multi_opinion")) {
      return { intent: "multi_opinion", confidence: 0.9, matchedPatterns: results.flatMap(r => r.matches) };
    }

    return {
      intent: best.intent,
      confidence: Math.min(1, best.matches.length * 0.4),
      matchedPatterns: best.matches,
    };
  },

  recommend(intent: IntentClass): ProviderRecommendation | null {
    return INTENT_PROVIDER_MAP[intent] || null;
  },

  async decide(message: string, userLockProvider?: string | null): Promise<{
    intent: IntentClass;
    confidence: number;
    recommendation: ProviderRecommendation | null;
    suggestedProvider: string;
    overridden: boolean;
  }> {
    const match = ProviderIntelligence.classify(message);
    const recommendation = ProviderIntelligence.recommend(match.intent);

    recordEvidence("provider.intent.matched", {
      intent: match.intent,
      confidence: match.confidence,
      patterns: match.matchedPatterns,
    });

    if (!recommendation) {
      return {
        intent: match.intent,
        confidence: match.confidence,
        recommendation: null,
        suggestedProvider: userLockProvider || "kimi_local_web_api",
        overridden: false,
      };
    }

    // User lock overrides intent unless the locked provider is unhealthy
    let suggestedProvider = recommendation.primary;
    let overridden = false;

    if (userLockProvider) {
      if (recommendation.primary !== userLockProvider || recommendation.fallbacks.includes(userLockProvider)) {
        suggestedProvider = userLockProvider;
        overridden = true;
        recordEvidence("provider.intent.overridden", {
          intent: match.intent,
          suggestedByIntent: recommendation.primary,
          userLock: userLockProvider,
          resolvedTo: userLockProvider,
        });
      }
    }

    recordEvidence("provider.intent.suggested", {
      intent: match.intent,
      suggested: suggestedProvider,
      primary: recommendation.primary,
      fallbacks: recommendation.fallbacks,
      reason: recommendation.reason,
      userLock: userLockProvider,
      overridden,
    });

    return {
      intent: match.intent,
      confidence: match.confidence,
      recommendation,
      suggestedProvider,
      overridden,
    };
  },
};
