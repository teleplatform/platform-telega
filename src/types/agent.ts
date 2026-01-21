export type AgentRole = "sales" | "support" | "operator";

export type AgentTemplate = {
  role: AgentRole;
  name?: string;
  personality?: string;
  instructions?: string[];
  constraints?: string[];
};

export type KnowledgePack = {
  business_name?: string;
  description?: string;
  pricing?: Array<{
    item: string;
    price: string;
    details?: string;
  }>;
  faq?: Array<{
    question: string;
    answer: string;
  }>;
  policies?: Array<{
    title: string;
    content: string;
  }>;
  contacts?: {
    phone?: string;
    email?: string;
    address?: string;
    hours?: string;
  };
  policy_hints?: {
    intent_overrides?: Record<string, "cheap" | "smart" | "coding">;
  };
};

export type IntentType =
  | "buy"
  | "inquiry"
  | "booking"
  | "delivery"
  | "warranty"
  | "complaint"
  | "general";

export type Intent = {
  type: IntentType;
  confidence: number;
  entities?: Record<string, string>;
};
