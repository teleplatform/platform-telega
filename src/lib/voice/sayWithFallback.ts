import { isSayAvailable } from "./sayAvailable";

export async function sayWithFallback(
  attempt: () => Promise<Response>,
  fallback: () => Promise<Response>
): Promise<Response> {
  if (!isSayAvailable()) return fallback();
  try {
    return await attempt();
  } catch (e) {
    console.warn("[say] failed, fallback:", e);
    return fallback();
  }
}
