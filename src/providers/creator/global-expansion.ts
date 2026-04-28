import fs from "fs/promises";
import path from "path";

const TELEGA_DIR = path.join(process.cwd(), "data", "telega");
const CURRENCIES_FILE = path.join(TELEGA_DIR, "currencies.jsonl");
const REGIONS_FILE = path.join(TELEGA_DIR, "regions.jsonl");
const USER_LOCALES_FILE = path.join(TELEGA_DIR, "user-locales.jsonl");

export type CurrencyCode = "USD" | "UZS" | "RUB" | "KZT" | "EUR" | "TNT";

export interface Currency {
  code: CurrencyCode;
  name: string;
  symbol: string;
  rate_to_base: number;
  decimals: number;
  updated_at: number;
}

export interface Region {
  region_code: string;
  name: string;
  language_default: "ru" | "en" | "uz";
  currency_default: CurrencyCode;
  currency_symbol: string;
  payment_providers: string[];
  content_rules: string[];
  moderation_level: "strict" | "moderate" | "relaxed";
  timezone: string;
  active: boolean;
}

export interface UserLocale {
  user_id: string;
  country: string;
  language: "ru" | "en" | "uz";
  currency: CurrencyCode;
  detected_at: number;
  updated_at: number;
}

const DEFAULT_CURRENCIES: Currency[] = [
  { code: "TNT", name: "Teleton", symbol: "TN", rate_to_base: 1, decimals: 0, updated_at: Date.now() },
  { code: "USD", name: "US Dollar", symbol: "$", rate_to_base: 12600, decimals: 2, updated_at: Date.now() },
  { code: "UZS", name: "Uzbek Sum", symbol: "so'm", rate_to_base: 1, decimals: 0, updated_at: Date.now() },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", rate_to_base: 140, decimals: 2, updated_at: Date.now() },
  { code: "KZT", name: "Kazakhstani Tenge", symbol: "₸", rate_to_base: 28, decimals: 2, updated_at: Date.now() },
  { code: "EUR", name: "Euro", symbol: "€", rate_to_base: 13800, decimals: 2, updated_at: Date.now() },
];

const DEFAULT_REGIONS: Region[] = [
  {
    region_code: "UZ",
    name: "Uzbekistan",
    language_default: "uz",
    currency_default: "UZS",
    currency_symbol: "so'm",
    payment_providers: ["click", "payme", "apelsin"],
    content_rules: ["no_alcohol", "no_weapons", "local_law"],
    moderation_level: "strict",
    timezone: "Asia/Tashkent",
    active: true,
  },
  {
    region_code: "RU",
    name: "Russia",
    language_default: "ru",
    currency_default: "RUB",
    currency_symbol: "₽",
    payment_providers: ["yoomoney", "sberbank", "tinkoff"],
    content_rules: ["no_illegal", "no_fake"],
    moderation_level: "moderate",
    timezone: "Europe/Moscow",
    active: true,
  },
  {
    region_code: "KZ",
    name: "Kazakhstan",
    language_default: "ru",
    currency_default: "KZT",
    currency_symbol: "₸",
    payment_providers: ["kassa24", "halyk"],
    content_rules: ["no_illegal"],
    moderation_level: "moderate",
    timezone: "Asia/Almaty",
    active: true,
  },
  {
    region_code: "EU",
    name: "Europe",
    language_default: "en",
    currency_default: "EUR",
    currency_symbol: "€",
    payment_providers: ["stripe", "paypal"],
    content_rules: ["gdpr", "no_hate"],
    moderation_level: "relaxed",
    timezone: "Europe/London",
    active: true,
  },
  {
    region_code: "US",
    name: "United States",
    language_default: "en",
    currency_default: "USD",
    currency_symbol: "$",
    payment_providers: ["stripe", "paypal"],
    content_rules: ["no_illegal", "ccpa"],
    moderation_level: "relaxed",
    timezone: "America/New_York",
    active: true,
  },
];

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(TELEGA_DIR, { recursive: true });
  } catch {}
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function initCurrencies(): Promise<void> {
  try {
    await ensureDir();
    try {
      await fs.access(CURRENCIES_FILE);
    } catch {
      for (const c of DEFAULT_CURRENCIES) {
        await appendCurrency(c);
      }
    }
  } catch (e) {
    console.error("[currency] init failed", e);
  }
}

export async function initRegions(): Promise<void> {
  try {
    await ensureDir();
    try {
      await fs.access(REGIONS_FILE);
    } catch {
      for (const r of DEFAULT_REGIONS) {
        await appendRegion(r);
      }
    }
  } catch (e) {
    console.error("[region] init failed", e);
  }
}

async function appendCurrency(currency: Currency): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(currency) + "\n";
    await fs.appendFile(CURRENCIES_FILE, line, "utf-8");
  } catch (e) {
    console.error("[currency] write failed", e);
  }
}

async function appendRegion(region: Region): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(region) + "\n";
    await fs.appendFile(REGIONS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[region] write failed", e);
  }
}

async function appendUserLocale(locale: UserLocale): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(locale) + "\n";
    await fs.appendFile(USER_LOCALES_FILE, line, "utf-8");
  } catch (e) {
    console.error("[locale] write failed", e);
  }
}

export async function loadCurrencies(): Promise<Currency[]> {
  const currencies: Currency[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(CURRENCIES_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.code) currencies.push(parsed);
      } catch {}
    }
  } catch {}
  return currencies;
}

export async function loadRegions(): Promise<Region[]> {
  const regions: Region[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(REGIONS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.region_code) regions.push(parsed);
      } catch {}
    }
  } catch {}
  return regions;
}

export async function getCurrency(code: string): Promise<Currency | null> {
  const currencies = await loadCurrencies();
  return currencies.find(c => c.code === code) || null;
}

export async function getRegion(code: string): Promise<Region | null> {
  const regions = await loadRegions();
  return regions.find(r => r.region_code === code && r.active) || null;
}

export async function convertCurrency(
  amount: number,
  fromCode: string,
  toCode: string
): Promise<{ amount: number; rate: number }> {
  if (fromCode === toCode) return { amount, rate: 1 };
  
  const from = await getCurrency(fromCode);
  const to = await getCurrency(toCode);
  
  if (!from || !to) {
    throw new Error(`Currency not found: ${!from ? fromCode : toCode}`);
  }
  
  const amountInBase = amount / from.rate_to_base;
  const result = amountInBase * to.rate_to_base;
  
  const rounded = Math.round(result * Math.pow(10, to.decimals)) / Math.pow(10, to.decimals);
  
  return { amount: rounded, rate: to.rate_to_base / from.rate_to_base };
}

export async function convertTeletonToLocal(
  teletonAmount: number,
  currencyCode: CurrencyCode
): Promise<number> {
  const teleton = await getCurrency("TNT");
  if (!teleton) throw new Error("Teleton currency not found");

  const result = await convertCurrency(teletonAmount, "TNT", currencyCode);
  return result.amount;
}

export async function convertLocalToTeleton(
  localAmount: number,
  currencyCode: CurrencyCode
): Promise<number> {
  const result = await convertCurrency(localAmount, currencyCode, "TNT");
  return result.amount;
}

export async function getUserLocale(userId: string): Promise<UserLocale> {
  const locales: UserLocale[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(USER_LOCALES_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.user_id === userId) {
          locales.push(parsed);
        }
      } catch {}
    }
  } catch {}
  
  if (locales.length > 0) {
    return locales.sort((a, b) => b.updated_at - a.updated_at)[0];
  }
  
  return {
    user_id: userId,
    country: "UZ",
    language: "ru",
    currency: "UZS",
    detected_at: Date.now(),
    updated_at: Date.now(),
  };
}

export async function setUserLocale(
  userId: string,
  country?: string,
  language?: "ru" | "en" | "uz",
  currency?: CurrencyCode
): Promise<UserLocale> {
  const current = await getUserLocale(userId);
  
  const newLocale: UserLocale = {
    user_id: userId,
    country: country || current.country,
    language: language || current.language,
    currency: currency || current.currency,
    detected_at: current.detected_at,
    updated_at: Date.now(),
  };
  
  await appendUserLocale(newLocale);
  return newLocale;
}

export function formatPrice(amount: number, currency: Currency): string {
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  });
  return `${currency.symbol}${formatted}`;
}

export async function formatPriceWithConversion(
  teletonAmount: number,
  targetCurrency: CurrencyCode
): Promise<string> {
  const target = await getCurrency(targetCurrency);
  if (!target) return `${teletonAmount} TN`;
  
  const converted = await convertTeletonToLocal(teletonAmount, targetCurrency);
  return formatPrice(converted, target);
}

export async function getActiveRegions(): Promise<Region[]> {
  const regions = await loadRegions();
  return regions.filter(r => r.active);
}

export async function getRegionByCountry(countryCode: string): Promise<Region | null> {
  const regions = await loadRegions();
  return regions.find(r => r.region_code === countryCode && r.active) || null;
}

export function suggestRegion(telegramLanguageCode?: string, countryCode?: string): Region | null {
  if (countryCode) {
    const region = DEFAULT_REGIONS.find(r => r.region_code === countryCode.toUpperCase());
    if (region && region.active) return region;
  }
  
  if (telegramLanguageCode) {
    if (telegramLanguageCode.startsWith("ru")) {
      return DEFAULT_REGIONS.find(r => r.region_code === "RU") || null;
    }
    if (telegramLanguageCode.startsWith("uz")) {
      return DEFAULT_REGIONS.find(r => r.region_code === "UZ") || null;
    }
    if (telegramLanguageCode.startsWith("en")) {
      return DEFAULT_REGIONS.find(r => r.region_code === "US") || null;
    }
  }
  
  return DEFAULT_REGIONS.find(r => r.region_code === "UZ") || null;
}

export function formatRatesList(currencies: Currency[]): string {
  const lines = ["💱 Exchange Rates (to Teleton):\n"];
  for (const c of currencies) {
    const base = c.code === "TNT" ? "1" : `${c.rate_to_base.toLocaleString()}`;
    lines.push(`${c.symbol} ${c.code}: ${base} TN`);
  }
  return lines.join("\n");
}

export function formatRegionList(regions: Region[]): string {
  const lines = ["🌍 Available Regions:\n"];
  for (const r of regions) {
    if (!r.active) continue;
    const flag = r.region_code === "UZ" ? "🇺🇿" : r.region_code === "RU" ? "🇷🇺" : r.region_code === "KZ" ? "🇰🇿" : r.region_code === "EU" ? "🇪🇺" : "🇺🇸";
    lines.push(`${flag} ${r.name} (${r.region_code})`);
    lines.push(`   Lang: ${r.language_default} | Currency: ${r.currency_default} | ${r.payment_providers.slice(0, 2).join(", ")}`);
  }
  return lines.join("\n");
}

export function formatUserLocale(locale: UserLocale): string {
  const flags: Record<string, string> = { UZ: "🇺🇿", RU: "🇷🇺", KZ: "🇰🇿", EU: "🇪🇺", US: "🇺🇸" };
  const flag = flags[locale.country] || "🌍";
  
  return `${flag} Your Locale:
Country: ${locale.country}
Language: ${locale.language.toUpperCase()}
Currency: ${locale.currency}`;
}