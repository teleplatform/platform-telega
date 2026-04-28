export type RuntimeRole = "owner_creator_primary" | "owner_creator_secondary" | "partner_creator" | "public";
export type RuntimeMode = "creator" | "public";
export type Capability = "creator_menu" | "partner_menu" | "creator_tools" | "partner_visual_tools" | "image_generation" | "safe_content_tools" | "telega_user_surface" | "safe_operator_tools" | "creator_bridge_use" | "provider_web_sessions" | "runtime_admin" | "policy_override" | "diagnostics_full" | "vault_access" | "forge_access" | "code_generation" | "internal_ops" | "voice_input" | "read_aloud" | "voice_output" | "file_upload" | "file_reading" | "auto_file_fallback" | "all_chat_actions" | "safe_chat_actions";
export declare function isOwnerPrimary(userId?: string | number | null): boolean;
export declare function isOwnerSecondary(userId?: string | number | null): boolean;
export declare function isAnyOwnerCreator(userId?: string | number | null): boolean;
export declare function getOwnerCreatorIds(): Set<string>;
export declare function getPartnerCreatorIds(): Set<string>;
export declare function normalizeUserId(userId?: string | number | null): string;
export declare function getRuntimeRole(userId?: string | number | null): RuntimeRole;
export declare function getRuntimeMode(userId?: string | number | null): RuntimeMode;
export declare function isOwnerCreator(userId?: string | number | null): boolean;
export declare function isPartnerCreator(userId?: string | number | null): boolean;
export declare function isAnyCreator(userId?: string | number | null): boolean;
export declare function hasCapability(userId?: string | number | null, capability?: Capability): boolean;
export type AccessLogEvent = "capability_check" | "role_determined" | "mode_normalized" | "creator_mode_violation" | "provider_allowed" | "provider_forbidden";
export interface AccessLogPayload {
    userId?: string;
    role?: string;
    capability?: string;
    provider?: string;
    reason?: string;
    requestMode?: string;
}
export declare function assertCapability(userId: string | number | null | undefined, capability: Capability): void;
export declare function assertCreatorRequestAllowed(params: {
    userId?: string | number | null;
    requestMode?: string | null;
}): void;
export type SessionShape = {
    userId?: string | number | null;
    role?: string | null;
    mode?: string | null;
    bridgeEnabled?: boolean | null;
    creatorToolsEnabled?: boolean | null;
};
export declare function enforceRuntimeAccess<T extends SessionShape>(session: T): T & {
    role: RuntimeRole;
    mode: RuntimeMode;
    bridgeEnabled: boolean;
    creatorToolsEnabled: boolean;
};
export declare function assertCreatorProviderAllowed(params: {
    userId?: string | number | null;
    provider: string;
}): void;
export declare function getRoleDescription(userId?: string | number | null): string;
