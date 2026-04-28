export function assertForgeControlAllowed(role: string) {
  if (
    role !== "owner_creator_primary" &&
    role !== "owner_creator_secondary"
  ) {
    throw new Error("forge_control_forbidden");
  }
}
