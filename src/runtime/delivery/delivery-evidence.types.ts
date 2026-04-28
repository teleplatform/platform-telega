export type DeliveryStatus =
  | "success"
  | "blocked"
  | "fallback"
  | "error";

export type DeliveryEvidenceRecord = {
  traceId: string;
  chatId: number;

  provider: string;
  transport: "cdp" | "api" | "local";

  inputLength: number;
  outputLength: number;

  chunks: number;

  status: DeliveryStatus;
  reason?: string;

  createdAt: number;
};