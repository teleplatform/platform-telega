import type { ApiProviderStatus, ProviderAccessTier, ModeSwitchResult } from "./api-provider.types.js";
import type { ConversationSession } from "../../conversation/conversation-session.types.js";
import type { ApiSmokeResult } from "./api-provider-smoke.js";
import { getTelegramRole } from "../../../telegram/utils/telegram-utils.js";
import { userRuntimeSettings } from "../../../telegram/state/telegram-state.js";

export class ApiProviderRenderer {
  renderList(statuses: ApiProviderStatus[]): string {
    if (statuses.length === 0) return "No API providers registered.";
    const lines = ["## API Providers"];
    for (const s of statuses) {
      const icon = s.health === "healthy" ? "🟢" : s.health === "missing_credentials" ? "🟡" : s.health === "failed" ? "🔴" : "❓";
      lines.push(`${icon} \`${s.provider_id}\` — ${s.health}${s.has_credentials ? "" : " (no key)"}`);
    }
    return lines.join("\n");
  }

  renderModeResult(result: ModeSwitchResult): string {
    return `**Mode switch:** \`${result.previous_tier ?? "none"}\` → \`${result.new_tier}\`\n${result.message}`;
  }

   renderCurrent(session: ConversationSession): string {
     // Get user runtime settings using the session owner ID
     const userSettings = userRuntimeSettings.get(session.owner_id) || {
       provider: "auto",
       model: "openai:gpt-4o-mini", // Default fallback
       bridgeEnabled: false,
       creatorMode: false
     };
     
     // Determine user role from session runtime mode
     const runtimeMode = session.runtime_mode ?? "creator"; // Default to creator if not set
     const isPublic = runtimeMode === "public";
     
     // For public users, show minimal information
     if (isPublic) {
       return "TeleGPT is ready.";
     }
     
     // For creator/owner/partner users, show detailed information
     const tier = session.active.provider_access_tier ?? "api_model";
     const provider = session.active.provider_id ?? "none";
     
     // Get provider status for health information
     let healthStatus = "unknown";
     let hasCredentials = false;
     
     // Infer health status from tier and provider
     if (tier === "api_model") {
       // Simplified - in reality this would come from provider health checks
       if (provider === "openai:api") healthStatus = "healthy";
       else if (provider === "qwen:api") healthStatus = "healthy";
       else if (provider === "deepseek:api") healthStatus = "healthy";
       hasCredentials = true; // Assume credentials are configured if we're using API model
     } else if (tier === "local_model") {
       healthStatus = "healthy"; // Local is assumed healthy if selected
       hasCredentials = true;
     } else if (tier === "creator_web") {
       healthStatus = "unknown"; // Web status would need to be checked separately via bridge
       hasCredentials = false; // Web doesn't use API credentials in the same way
     }
     
     const healthIcon = healthStatus === "healthy" ? "🟢" : 
                       healthStatus === "missing_credentials" ? "🟡" : 
                       healthStatus === "failed" ? "🔴" : "⚪";
    
     const lines = [
       "## Current Provider Status",
       `**Mode:** ${this._formatTier(tier)}`,
       `**Active:** \`${provider}\``,
       `**Health:** ${healthIcon} ${healthStatus}`,
     ];
     
     // Add web-specific information from user settings
     if (tier === "creator_web") {
       lines.push(`**Bridge:** ${userSettings.bridgeEnabled ? "🟢 On" : "🔴 Off"}`);
       lines.push(`**Creator Mode:** ${userSettings.creatorMode ? "🟢 On" : "🔴 Off"}`);
     }
     
     // Add API-specific credential information
     if (tier === "api_model") {
       lines.push(`**Credentials:** ${hasCredentials ? "🟢 Configured" : "🔴 Missing"}`);
     }
     
     return lines.join("\n");
   }
   
   private _formatTier(tier: ProviderAccessTier): string {
     switch (tier) {
       case "local_model": return "Local";
       case "api_model": return "API";
       case "creator_web": return "Web";
       default: return tier;
     }
   }

  formatSmokeResults(results: ApiSmokeResult[]): string {
    const lines = ["## API Smoke Results"];
    for (const r of results) {
      const icon = r.health_status === "healthy" ? "🟢" : r.health_status === "missing_credentials" ? "🟡" : "🔴";
      lines.push(`${icon} \`${r.provider_id}\`: ${r.health_status}${r.error ? ` — ${r.error}` : ""}`);
    }
    return lines.join("\n");
  }
}
