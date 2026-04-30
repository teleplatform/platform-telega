import type { ProviderCapability } from "../../runtime-economics-contracts/src/provider.js";

export function filterProvidersByPolicy(providers: ProviderCapability[], context: {
  local_only_required?: boolean;
  privacy_class?: string;
  denied_providers?: string[];
}): ProviderCapability[] {
  return providers.filter((p) => {
    if (context.local_only_required && p.privacy_class !== "local_only") return false;
    if (context.denied_providers?.includes(p.provider_id)) return false;
    return true;
  });
}
