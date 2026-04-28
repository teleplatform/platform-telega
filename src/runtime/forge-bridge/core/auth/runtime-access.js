const OWNER_CREATOR_PRIMARY_IDS = new Set([
    "267246987",
]);
const OWNER_CREATOR_SECONDARY_IDS = new Set([
    "1166943180",
]);
const PARTNER_CREATOR_IDS = new Set([
    "591948691",
]);
export function isOwnerPrimary(userId) {
    return OWNER_CREATOR_PRIMARY_IDS.has(normalizeUserId(userId));
}
export function isOwnerSecondary(userId) {
    return OWNER_CREATOR_SECONDARY_IDS.has(normalizeUserId(userId));
}
export function isAnyOwnerCreator(userId) {
    const id = normalizeUserId(userId);
    return OWNER_CREATOR_PRIMARY_IDS.has(id) || OWNER_CREATOR_SECONDARY_IDS.has(id);
}
export function getOwnerCreatorIds() {
    return new Set([...OWNER_CREATOR_PRIMARY_IDS, ...OWNER_CREATOR_SECONDARY_IDS]);
}
export function getPartnerCreatorIds() {
    return new Set(PARTNER_CREATOR_IDS);
}
export function normalizeUserId(userId) {
    return userId == null ? "" : String(userId);
}
export function getRuntimeRole(userId) {
    const id = normalizeUserId(userId);
    if (OWNER_CREATOR_PRIMARY_IDS.has(id))
        return "owner_creator_primary";
    if (OWNER_CREATOR_SECONDARY_IDS.has(id))
        return "owner_creator_secondary";
    if (PARTNER_CREATOR_IDS.has(id))
        return "partner_creator";
    return "public";
}
export function getRuntimeMode(userId) {
    const role = getRuntimeRole(userId);
    return role === "public" ? "public" : "creator";
}
export function isOwnerCreator(userId) {
    return isAnyOwnerCreator(userId);
}
export function isPartnerCreator(userId) {
    return getRuntimeRole(userId) === "partner_creator";
}
export function isAnyCreator(userId) {
    const role = getRuntimeRole(userId);
    return role.startsWith("owner_creator") || role === "partner_creator";
}
function isAnyOwnerRole(role) {
    return role.startsWith("owner_creator");
}
function isPartnerOrAbove(role) {
    return role.startsWith("owner_creator") || role === "partner_creator";
}
function isNotPublic(role) {
    return role !== "public";
}
export function hasCapability(userId, capability) {
    const role = getRuntimeRole(userId);
    switch (capability) {
        case "creator_menu":
            return isAnyOwnerRole(role);
        case "partner_menu":
            return role === "partner_creator";
        case "creator_tools":
            return isAnyOwnerRole(role) || role === "partner_creator";
        case "partner_visual_tools":
            return role === "partner_creator";
        case "image_generation":
            return isPartnerOrAbove(role);
        case "safe_content_tools":
            return isNotPublic(role);
        case "telega_user_surface":
            return isNotPublic(role);
        case "safe_operator_tools":
            return isPartnerOrAbove(role);
        case "creator_bridge_use":
            return isAnyOwnerRole(role);
        case "provider_web_sessions":
            return isAnyOwnerRole(role);
        case "runtime_admin":
            return isAnyOwnerRole(role);
        case "policy_override":
            return isAnyOwnerRole(role);
        case "diagnostics_full":
            return isAnyOwnerRole(role);
        case "vault_access":
            return isAnyOwnerRole(role);
        case "forge_access":
            return isAnyOwnerRole(role);
        case "code_generation":
            return isAnyOwnerRole(role);
        case "internal_ops":
            return isAnyOwnerRole(role);
        case "voice_input":
            return isPartnerOrAbove(role);
        case "read_aloud":
            return isPartnerOrAbove(role);
        case "voice_output":
            return isAnyOwnerRole(role);
        case "file_upload":
            return true;
        case "file_reading":
            return isPartnerOrAbove(role);
        case "auto_file_fallback":
            return isNotPublic(role);
        case "all_chat_actions":
            return isAnyOwnerRole(role);
        case "safe_chat_actions":
            return isPartnerOrAbove(role);
        default:
            return false;
    }
}
const accessLog = ((event, payload) => {
    console.log(`[access:${event}]`, JSON.stringify(payload || {}));
});
accessLog.warn = function (event, payload) {
    console.warn(`[access:${event}]`, JSON.stringify(payload || {}));
};
export function assertCapability(userId, capability) {
    if (!hasCapability(userId, capability)) {
        accessLog.warn("capability_check", {
            userId: normalizeUserId(userId),
            role: getRuntimeRole(userId),
            capability,
            reason: "forbidden",
        });
        throw new Error("capability_forbidden");
    }
}
export function assertCreatorRequestAllowed(params) {
    const { userId, requestMode } = params;
    const role = getRuntimeRole(userId);
    if (requestMode === "creator" && role === "public") {
        accessLog.warn("creator_mode_violation", {
            userId: normalizeUserId(userId),
            role,
            requestMode,
            reason: "identity_not_allowed",
        });
        throw new Error("creator_mode_forbidden");
    }
}
export function enforceRuntimeAccess(session) {
    const role = getRuntimeRole(session.userId);
    const mode = role === "public" ? "public" : "creator";
    return {
        ...session,
        role,
        mode,
        bridgeEnabled: role.startsWith("owner_creator") ? Boolean(session.bridgeEnabled) : false,
        creatorToolsEnabled: role !== "public",
    };
}
export function assertCreatorProviderAllowed(params) {
    const creatorOnlyProviders = new Set([
        "openai_web",
        "qwen_web",
        "deepseek_web",
        "creator_bridge",
    ]);
    const role = getRuntimeRole(params.userId);
    if (creatorOnlyProviders.has(params.provider) && !role.startsWith("owner_creator")) {
        accessLog.warn("provider_forbidden", {
            userId: normalizeUserId(params.userId),
            role,
            provider: params.provider,
            reason: "provider_requires_owner_creator",
        });
        throw new Error("creator_provider_forbidden");
    }
}
export function getRoleDescription(userId) {
    const role = getRuntimeRole(userId);
    const id = normalizeUserId(userId);
    if (OWNER_CREATOR_PRIMARY_IDS.has(id)) {
        return `owner_creator_primary (${id})`;
    }
    if (OWNER_CREATOR_SECONDARY_IDS.has(id)) {
        return `owner_creator_secondary (${id})`;
    }
    if (PARTNER_CREATOR_IDS.has(id)) {
        return `partner_creator (${id})`;
    }
    return `public (${id})`;
}
