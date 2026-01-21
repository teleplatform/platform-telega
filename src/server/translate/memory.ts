const PROTECTED = [
  "Teleton",
  "MarketBase",
  "Services",
  "Lounge",
  "Caravan",
  "Tele•GPT",
  "Tele•Ga",
];

export function protectTokens(input: string) {
  const map = new Map<string, string>();
  let out = input;

  PROTECTED.forEach((token, idx) => {
    const key = `__TG_PROTECT_${idx}__`;
    const re = new RegExp(escapeRegExp(token), "g");
    if (re.test(out)) {
      out = out.replace(re, key);
      map.set(key, token);
    }
  });

  return { protectedText: out, restoreMap: map };
}

export function restoreTokens(input: string, restoreMap: Map<string, string>) {
  let out = input;
  for (const [k, v] of restoreMap.entries()) out = out.replaceAll(k, v);
  return out;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
