const BRAND = ["Tele•Ga", "Tele•GPT", "Teleton", "MarketBase", "Services", "Forge"];

export function enforceBrands(out: string): string {
  // частые поломки: TeleGa / Tele GPT / Teleton -> возвращаем к канону
  return out
    .replace(/\bTeleGa\b/g, "Tele•Ga")
    .replace(/\bTele\s*GPT\b/gi, "Tele•GPT")
    .replace(/\bMarket\s*Base\b/gi, "MarketBase")
    .replace(/\bTele\s*ton\b/gi, "Teleton");
}

export { BRAND };
