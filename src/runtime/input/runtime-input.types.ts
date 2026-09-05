export type RuntimeSurface =
  | "telegram"
  | "web"
  | "voice"
  | "ide"
  | "browser"
  | "api";

export type RuntimeInputType =
  | "text"
  | "voice"
  | "file"
  | "image"
  | "link"
  | "command";

export interface RuntimeAttachment {
  id: string;
  kind: "file" | "image" | "audio" | "video" | "link";
  name?: string;
  mime_type?: string;
  url?: string;
  local_path?: string;
}

export interface RuntimeInputMetadata {
  source_message_id?: string;
  chat_id?: string;
  project_id?: string;
  repo_path?: string;
  locale?: string;
  runtime_mode?: "public" | "creator" | "internal";
  creator_verified?: boolean;
  creator_user_id?: string;
  raw?: unknown;
}

export interface RuntimeInput {
  input_id: string;
  user_id: string;
  surface: RuntimeSurface;
  type: RuntimeInputType;
  content: string;
  attachments: RuntimeAttachment[];
  metadata: RuntimeInputMetadata;
  received_at: string;
}
