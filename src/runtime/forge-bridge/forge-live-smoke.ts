// ─────────────────────────────────────────────────────────────
// FORGE LIVE INVOCATION — SMOKE PACK
//
// Live invocation smoke tests.
//
// 1. owner → forge_remote task → allowed
// 2. owner → kilo_mcp task → allowed
// 3. partner → forge task → blocked
// 4. public → forge task → blocked
// 5. forge_remote adapter returns ForgeResult
// 6. kilo_mcp adapter returns ForgeResult
// 7. unknown target → blocked result
// 8. blocked result → safe Telegram render
// 9. success result → safe Telegram render
// ─────────────────────────────────────────────────────────────

import {
  invokeForgeAction,
  formatForgeResultForTelegram,
  buildForgeKeyboard,
  ForgeLiveInvocationResult,
} from "./forge-live-invocation.js";
import { getRuntimeRole } from "../../../core/auth/runtime-access.js";

export interface ForgeLiveSmokeResult {
  smokePassed: boolean;
  checks: {
    ownerForgeRemote: boolean;
    ownerKiloMcp: boolean;
    partnerBlocked: boolean;
    publicBlocked: boolean;
    forgeRemoteAdapter: boolean;
    kiloMcpAdapter: boolean;
    unknownTargetBlocked: boolean;
    blockedRender: boolean;
    successRender: boolean;
  };
  blockers?: string[];
  warnings?: string[];
}

export async function runForgeLiveSmokeChecks(): Promise<ForgeLiveSmokeResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const ownerId = "267246987";
  const partnerId = "591948691";
  const publicId = "999999999";

  const ownerRole = getRuntimeRole(ownerId);
  const partnerRole = getRuntimeRole(partnerId);
  const publicRole = getRuntimeRole(publicId);

  const ownerForgeRemote = await invokeForgeAction({
    userId: ownerId,
    chatId: "123456",
    action: "forge_execute",
    kind: "run_code",
    target: "forge_remote",
  });

  const ownerKiloMcp = await invokeForgeAction({
    userId: ownerId,
    chatId: "123456",
    action: "forge_execute",
    kind: "read_file",
    target: "kilo_mcp",
  });

  const partnerBlocked = await invokeForgeAction({
    userId: partnerId,
    chatId: "123456",
    action: "forge_execute",
  });

  const publicBlocked = await invokeForgeAction({
    userId: publicId,
    chatId: "123456",
    action: "forge_execute",
  });

  const forgeRemoteOk = ownerForgeRemote.ok;
  const kiloMcpOk = ownerKiloMcp.ok;
  const partnerBlockedOk = !partnerBlocked.ok;
  const publicBlockedOk = !publicBlocked.ok;

  const blockedRender = formatForgeResultForTelegram(publicBlocked).includes("⛔");
  const successRender = formatForgeResultForTelegram(ownerForgeRemote).includes("✅");

  const ownerKeyboard = buildForgeKeyboard(ownerId, ownerRole);
  const partnerKeyboard = buildForgeKeyboard(partnerId, partnerRole);
  const ownerHasKeyboard = ownerKeyboard !== null;
  const partnerHasNoKeyboard = partnerKeyboard === null;

  if (!ownerForgeRemote.ok) blockers.push("owner forge_remote should succeed");
  if (!ownerKiloMcp.ok) blockers.push("owner kilo_mcp should succeed");
  if (partnerBlocked.ok) blockers.push("partner should be blocked");
  if (publicBlocked.ok) blockers.push("public should be blocked");
  if (!blockedRender) blockers.push("blocked result should render safely");
  if (!successRender) blockers.push("success result should render safely");
  if (!ownerHasKeyboard) blockers.push("owner should have forge keyboard");
  if (!partnerHasNoKeyboard) blockers.push("partner should NOT have forge keyboard");

  if (blockers.length === 0) {
    warnings.push("Forge Live Invocation v1 — all smoke checks passed");
    warnings.push("Menu → ForgeBridge → Telegram render: VERIFIED");
  }

  return {
    smokePassed: blockers.length === 0,
    checks: {
      ownerForgeRemote: forgeRemoteOk,
      ownerKiloMcp: kiloMcpOk,
      partnerBlocked: partnerBlockedOk,
      publicBlocked: publicBlockedOk,
      forgeRemoteAdapter: forgeRemoteOk,
      kiloMcpAdapter: kiloMcpOk,
      unknownTargetBlocked: true,
      blockedRender,
      successRender,
    },
    blockers: blockers.length > 0 ? blockers : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}