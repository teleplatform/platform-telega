const BRAND = ["Tele•Ga", "Tele•GPT", "Teleton", "MarketBase", "Services", "Forge"];

export function enforceBrands(out: string) {
  const keep = out
    .replace(/\bTeleGa\b/g, "Tele•Ga")
    .replace(/\bTele\s*GPT\b/gi, "Tele•GPT")
    .replace(/\bMarket\s*Base\b/gi, "MarketBase")
    .replace(/\bTele\s*ton\b/gi, "Teleton");

  return BRAND.reduce((acc, term) => acc.replace(new RegExp(term, "g"), term), keep);
}
