export type Intent = "buy" | "inquiry" | "booking" | "delivery" | "warranty" | "unknown";
export type IntentResult = {
  intent: Intent;
  confidence: number;
  reason: string;
  source: "keyword" | "llm";
};

function hit(text: string, words: string[]) {
  return words.some((w) => text.includes(w));
}

export function classifyIntentV1(inputRaw: string): IntentResult {
  const t = inputRaw.toLowerCase();

  if (hit(t, ["куп", "закаж", "оформ", "оплат", "сколько стоит", "цена"])) {
    return { intent: "buy", confidence: 0.78, reason: "keywords:buy", source: "keyword" };
  }
  if (hit(t, ["запис", "бронь", "время", "когда можно", "свободно"])) {
    return { intent: "booking", confidence: 0.76, reason: "keywords:booking", source: "keyword" };
  }
  if (hit(t, ["достав", "курьер", "самовывоз", "адрес", "срок"])) {
    return { intent: "delivery", confidence: 0.74, reason: "keywords:delivery", source: "keyword" };
  }
  if (hit(t, ["гарант", "возврат", "претенз", "некачеств", "исправ"])) {
    return { intent: "warranty", confidence: 0.72, reason: "keywords:warranty", source: "keyword" };
  }
  if (hit(t, ["что такое", "расскажи", "как работает", "подскажи", "интересует"])) {
    return { intent: "inquiry", confidence: 0.66, reason: "keywords:inquiry", source: "keyword" };
  }

  return { intent: "unknown", confidence: 0.4, reason: "no_keywords", source: "keyword" };
}
