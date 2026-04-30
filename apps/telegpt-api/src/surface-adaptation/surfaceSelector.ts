import type { SurfaceChannel } from "./types.js";

export function selectSurface(channel: string): SurfaceChannel {
  if (channel === "web") {
    return "web";
  }

  if (channel === "telegram") {
    return "telegram";
  }

  if (channel === "alice") {
    return "alice";
  }

  return "voice";
}
