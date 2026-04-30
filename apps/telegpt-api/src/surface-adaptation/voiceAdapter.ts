function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function reduceClauseWeight(sentence: string): string {
  if (sentence.length > 80) {
    return sentence.replace(/,\s*(который|которая|которые|чтобы|потому что|хотя|однако)\b/giu, ". ").trim();
  }

  return sentence;
}

export function adaptForVoice(text: string): string {
  const normalized = normalizeWhitespace(text);
  const sentences = splitSentences(normalized);

  const adapted = sentences.map(reduceClauseWeight);
  const joined = adapted.join(" ").trim();

  return /[.!?…]$/.test(joined) ? joined : `${joined}.`;
}
