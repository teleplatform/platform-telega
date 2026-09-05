export type SurfaceType =
  | "telegram" | "web" | "studio" | "voice"
  | "mission_control" | "forge" | "whatsapp" | "mobile" | "max" | "api";

export type SurfaceStatus = "active" | "inactive" | "maintenance" | "deprecated";

export interface SurfaceCapability {
  name: string;
  description: string;
}

export interface SurfaceRoute {
  path: string;
  method: string;
  description: string;
}

export interface Surface {
  surfaceId: string;
  name: string;
  type: SurfaceType;
  description: string;
  status: SurfaceStatus;
  capabilities: SurfaceCapability[];
  routes: SurfaceRoute[];
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}
