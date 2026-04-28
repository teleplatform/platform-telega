"use client";

import React from "react";
import type { AgentVoiceConfig } from "@/config/voiceAgents";

export function VoiceCanonBadge({
  agentVoice,
  voiceId,
}: {
  agentVoice: AgentVoiceConfig | null;
  voiceId?: string | null;
}) {
  const route = agentVoice ? "say" : voiceId ? "cosyvoice" : "default";

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/70">
      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
        route: {route}
      </span>

      {agentVoice ? (
        <>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
            preset: {agentVoice.preset}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
            speaker: {agentVoice.speaker}
          </span>
        </>
      ) : null}
    </div>
  );
}
