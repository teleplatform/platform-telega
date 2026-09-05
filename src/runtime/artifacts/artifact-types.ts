export type ArtifactType =
  | "plain_text"
  | "markdown"
  | "code_file"
  | "multi_file"
  | "zip_project"
  | "report"
  | "dataset"
  | "image"
  | "audio"
  | "video"
  | "capsule";

export type DeliveryIntent =
  | "message"
  | "chunks"
  | "file"
  | "file_with_preview"
  | "zip";

export interface ArtifactClassification {
  type: ArtifactType;
  delivery: DeliveryIntent;
  language?: string;
  filename?: string;
  reason: string;
  isExplicitFileRequest?: boolean;
  stats: {
    chars: number;
    lines: number;
    codeBlocks: number;
    largestCodeBlockChars: number;
  };
}

export type DeliveryMethod = "message" | "chunks" | "file" | "file_with_preview" | "zip";

export interface DeliveryPlan {
  /** Which delivery method to use */
  method: DeliveryMethod;
  /** Human-readable description of the plan */
  description: string;
  /** Telegram-specific delivery parameters */
  telegram: {
    chunkSize: number;
    fileThreshold: number;
    chunkCount?: number;
  };
  /** Artifact info carried through to renderers */
  artifact: {
    filename?: string;
    summary?: string;
    totalChars: number;
    totalLines: number;
    extractedFiles?: Array<{ filename: string; content: string }>;
  };
}
