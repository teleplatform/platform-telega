export type MediaKind = "image" | "video" | "story" | "cover";

export type MediaProviderId =
  | "image_runtime"
  | "video_runtime"
  | "story_runtime";

export type MediaTaskStatus =
  | "planned"
  | "queued"
  | "processing"
  | "done"
  | "failed";

export type MediaRequest = {
  id: string;
  kind: MediaKind;
  providerId: MediaProviderId;
  prompt?: string;
  sourceImageRef?: string | null;
  aspectRatio?: "1:1" | "4:5" | "16:9" | "9:16";
  createdAt: number;
};

export type MediaResult = {
  id: string;
  status: MediaTaskStatus;
  providerId: MediaProviderId;
  artifactRefs: string[];
  error?: string;
  finishedAt?: number;
};

export type MediaProviderConfig = {
  id: MediaProviderId;
  title: string;
  status: "active" | "planned" | "placeholder" | "disabled";
  kind: MediaKind[];
  visibility: "creator" | "user" | "internal";
};

export interface MediaRuntime {
  submit(request: MediaRequest): Promise<MediaResult>;
}
