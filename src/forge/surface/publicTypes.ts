export type PublicCapability =
  | "chat.send" | "chat.copy" | "chat.new"
  | "voice.input" | "voice.output"
  | "file.upload.safe"
  | "image.generate.public"
  | "translate.use"
  | "history.view";

export type PublicHiddenFeature =
  | "provider.debug" | "evidence.raw" | "policy.editor"
  | "override.controls" | "repair.controls" | "capsule.internals";

export interface PublicSurfaceState {
  mode: "public";
  capabilities: PublicCapability[];
  hidden: PublicHiddenFeature[];
  sessionId: string | null;
}

export interface PublicAction {
  actionId: string;
  name: string;
  capability: PublicCapability;
  description: string;
}
