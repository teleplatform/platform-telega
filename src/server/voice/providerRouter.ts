import type {
  AuthContext,
  VoiceCloneRequest,
  VoiceCloneResponse,
  VoiceSpeakRequest,
  VoiceSpeakResponse,
  VoiceConvertRequest,
  VoiceDialogueRequest,
} from "./types";
import { requireMaker, requireConsent } from "./policyGate";
import {
  localCosyClone,
  localCosySpeak,
  localCosyConvert,
  localCosyDialogue,
} from "@/workers/voice/localCosyVoiceWorker";

export async function handleClone(
  auth: AuthContext,
  req: VoiceCloneRequest
): Promise<VoiceCloneResponse> {
  const mk = requireMaker(auth);
  if (!mk.ok) return { status: "blocked", warnings: ["Maker mode required"], trace: { lane: "voice.policy" } };
  const cs = requireConsent(req.consent?.declared_owner_or_permission);
  if (!cs.ok) return { status: "blocked", warnings: ["Consent required"], trace: { lane: "voice.policy" } };
  return localCosyClone(auth, req);
}

export async function handleSpeak(
  auth: AuthContext,
  req: VoiceSpeakRequest
): Promise<VoiceSpeakResponse> {
  if (req.voice?.type === "cloned") {
    const mk = requireMaker(auth);
    if (!mk.ok) {
      return { status: "blocked", warnings: ["Maker mode required for cloned voice"], trace: { lane: "voice.policy" } };
    }
    return localCosySpeak(auth, req);
  }
  return localCosySpeak(auth, req);
}

export async function handleConvert(auth: AuthContext, req: VoiceConvertRequest) {
  const mk = requireMaker(auth);
  if (!mk.ok) return { status: "blocked", warnings: ["Maker mode required"], trace: { lane: "voice.policy" } };
  return localCosyConvert(auth, req);
}

export async function handleDialogue(auth: AuthContext, req: VoiceDialogueRequest) {
  const mk = requireMaker(auth);
  if (!mk.ok) return { status: "blocked", warnings: ["Maker mode required"], trace: { lane: "voice.policy" } };
  return localCosyDialogue(auth, req);
}
