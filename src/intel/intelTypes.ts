// @ts-nocheck
export type IntelType =
  | "update"
  | "promo"
  | "security"
  | "analytics"
  | "payments"
  | "content"
  | "seo"
  | "ads"
  | "other";

export type IntelCardV1 = {
  schema: "PANTHEON_INTEL_CARD_V1";
  id: string;
  created_at: string;
  source: string;
  type: IntelType;
  title: string;
  summary: string[];
  links: string[];
  signals: string[];
  tele_ga_impact: string[];
  proposed_pack: string;
  confidence: number;
  raw: {
    text: string;
    message_id?: number;
    chat_id?: number | string;
    from?: string;
  };
};

export type IntelIndexRowV1 = {
  id: string;
  created_at: string;
  source: string;
  type: IntelType;
  proposed_pack: string;
  title: string;
  file: string;
  fingerprint?: string;
};
