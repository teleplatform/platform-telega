export type ProviderKind =
  | "api"
  | "web"
  | "local"
  | "hybrid";

export type ProviderStrength =
  | "reasoning"
  | "coding"
  | "research"
  | "summarization"
  | "translation"
  | "planning"
  | "review"
  | "creative"
  | "multimodal";

export type ProviderAccessTier =
  | "local_model"
  | "api_model"
  | "creator_web";

export type RuntimeAccessMode =
  | "public"
  | "creator"
  | "internal";
