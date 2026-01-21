import type { Intent, IntentType } from "../types/agent.js";

const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  buy: ["buy", "purchase", "order", "want to get", "interested in buying", "cost", "price", "how much"],
  inquiry: ["question", "ask", "tell me about", "what is", "how does", "can you explain", "info", "information"],
  booking: ["book", "reserve", "appointment", "schedule", "when can", "available time", "slot"],
  delivery: ["deliver", "shipping", "ship", "send", "receive", "arrival", "when will", "tracking"],
  warranty: ["warranty", "guarantee", "return", "refund", "exchange", "broken", "defective", "replace"],
  complaint: ["complain", "unhappy", "dissatisfied", "problem with", "issue with", "not working", "disappointed"],
  general: [],
};

export function keywordIntent(message: string): {
  intent: IntentType;
  confidence: number;
  reason: string;
} {
  const lower = message.toLowerCase();
  const scores: Record<IntentType, number> = {
    buy: 0,
    inquiry: 0,
    booking: 0,
    delivery: 0,
    warranty: 0,
    complaint: 0,
    general: 0,
  };

  const matched: Record<IntentType, string[]> = {
    buy: [],
    inquiry: [],
    booking: [],
    delivery: [],
    warranty: [],
    complaint: [],
    general: [],
  };

  // Score each intent based on keyword matches
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === "general") continue;

    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        scores[intent as IntentType] += 1;
        matched[intent as IntentType].push(keyword);
      }
    }
  }

  // Find highest scoring intent
  let maxScore = 0;
  let detected: IntentType = "general";

  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detected = intent as IntentType;
    }
  }

  // Calculate confidence (simple heuristic)
  const confidence = maxScore > 0
    ? Math.min(0.5 + (maxScore * 0.2), 0.95)
    : 0.3;

  const reason = maxScore > 0
    ? `keyword match: ${matched[detected].slice(0, 3).join(", ")}`
    : "no_keyword_match";

  return {
    intent: detected,
    confidence,
    reason: reason.slice(0, 200),
  };
}

export function detectIntent(message: string): Intent {
  const r = keywordIntent(message);
  return { type: r.intent, confidence: r.confidence };
}
