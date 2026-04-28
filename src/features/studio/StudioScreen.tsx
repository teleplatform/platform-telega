"use client";

import { useState } from "react";
import {
  TeleChip,
  TeleGlassPanel,
  TeleHeaderBar,
  TeleToggle,
} from "@/components/tele";
import WalletPanel from "./wallet/WalletPanel";
import SkillsPanel from "./skills/SkillsPanel";
import ForgePanel from "./forge/ForgePanel";
import StudioOnboarding from "./StudioOnboarding";
import StudioEmptyState, { type StudioIntent } from "@/components/studio/StudioEmptyState";
import { useStudioActions } from "@/core/useStudioActions";

type Tab = "wallet" | "skills" | "forge";

export default function StudioScreen() {
  const [tab, setTab] = useState<Tab>("wallet");
  const [makerMode, setMakerMode] = useState(false);
  const [intent, setIntent] = useState<StudioIntent>("forge");
  const actions = useStudioActions(setTab);

  function onOnboardingDone(goal: "build" | "translate" | "agents" | "devtools", _runMode: "local" | "cloud") {
    if (goal === "build") {
      setIntent("forge");
      setTab("forge");
      return;
    }
    if (goal === "translate") {
      setIntent("translate");
      setTab("skills");
      return;
    }
    if (goal === "agents") {
      setIntent("agents");
      setTab("skills");
      return;
    }
    setIntent("devtools");
    setTab("skills");
  }

  return (
    <div className="min-h-screen tele-bg text-foreground">
      <StudioOnboarding onDone={onOnboardingDone} />
      <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-4">
        <TeleHeaderBar
          title="Studio"
          right={
            <div className="flex items-center gap-2">
              <TeleToggle
                leftLabel="Public"
                rightLabel="Maker"
                checked={makerMode}
                onCheckedChange={setMakerMode}
              />
            </div>
          }
        />

        <TeleGlassPanel className="p-3">
          <div className="flex flex-wrap gap-2">
            <TeleChip
              label="Wallet"
              active={tab === "wallet"}
              onClick={() => setTab("wallet")}
            />
            <TeleChip
              label="Skill Runner"
              active={tab === "skills"}
              onClick={() => setTab("skills")}
            />
            <TeleChip
              label="Forge"
              active={tab === "forge"}
              onClick={() => setTab("forge")}
            />
          </div>
        </TeleGlassPanel>

        {tab === "forge" && (
          <div className="space-y-4">
            <StudioEmptyState
              intent={intent}
              onPrimary={() => actions.primary(intent)}
              onSecondary={() => actions.secondary(intent)}
            />
            <ForgePanel makerMode={makerMode} />
          </div>
        )}
        {tab === "skills" && (
          <div className="space-y-4">
            <StudioEmptyState
              intent={intent}
              onPrimary={() => actions.primary(intent)}
              onSecondary={() => actions.secondary(intent)}
            />
            <SkillsPanel makerMode={makerMode} />
          </div>
        )}
        {tab === "wallet" && (
          <div className="space-y-4">
            <StudioEmptyState
              intent={intent}
              onPrimary={() => actions.primary(intent)}
              onSecondary={() => actions.secondary(intent)}
            />
            <WalletPanel makerMode={makerMode} />
          </div>
        )}
      </div>
    </div>
  );
}
