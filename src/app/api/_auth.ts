import type { AuthContext } from "@/server/voice/types";

export async function getAuthContext(): Promise<AuthContext> {
  // TODO: заменить на твой реальный auth (session/jwt/rbac)
  return { userId: "demo_user", roles: ["public"] };
}
