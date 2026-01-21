export type Mode = "public" | "maker";
export type Lang = "auto" | "ru" | "uz" | "en";
export type Format = "plain" | "ui_strings" | "json" | "csv";

export type StyleId =
  | "none"
  | "natural"
  | "formal"
  | "simple"
  | "academic"
  | "marketing"
  | "short"
  | "uz_colloquial"
  | "ru_business"
  | "telegram"
  | "ui_strings"
  | "json_csv_batch"
  | "tele_ga_voice";

export type TranslateRequest = {
  sourceText: string;
  sourceLang: Lang;
  targetLang: Exclude<Lang, "auto">;
  styleId: StyleId;
  mode: Mode;
  format: Format;
};

export type TranslateResponse = {
  translatedText: string;
  detectedLang?: Exclude<Lang, "auto">;
  styleApplied: StyleId;
  format: Format;
  warnings?: string[];
};
