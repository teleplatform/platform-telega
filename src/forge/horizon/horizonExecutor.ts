import { HorizonPlan, HorizonPhase, HorizonMilestone, HorizonPhaseStatus } from "./horizonTypes";
import { HorizonRegistry } from "./horizonRegistry";
import { MissionRegistry } from "../mission/missionRegistry.js";

export function activateHorizon(planId: string): HorizonPlan | null {
  const plan = HorizonRegistry.get(planId);
  if (!plan || plan.status !== "draft") return null;

  const now = Date.now();
  const firstPhase = plan.phases[0];
  if (firstPhase) firstPhase.status = "active";

  return HorizonRegistry.update(planId, {
    status: "active",
    startedAt: now,
    phases: plan.phases,
  });
}

export function completeHorizon(planId: string): HorizonPlan | null {
  return HorizonRegistry.update(planId, {
    status: "completed",
    completedAt: Date.now(),
  });
}

export function failHorizon(planId: string): HorizonPlan | null {
  return HorizonRegistry.update(planId, {
    status: "failed",
    completedAt: Date.now(),
  });
}

export function activatePhase(planId: string, phaseId: string): HorizonPlan | null {
  const plan = HorizonRegistry.get(planId);
  if (!plan) return null;

  const phase = plan.phases.find((p) => p.id === phaseId);
  if (!phase || (phase.status !== "pending" && phase.status !== "active")) return null;

  phase.status = "active";
  phase.startedAt = Date.now();
  return HorizonRegistry.update(planId, { phases: plan.phases });
}

export function completePhase(planId: string, phaseId: string): HorizonPlan | null {
  const plan = HorizonRegistry.get(planId);
  if (!plan) return null;

  const phase = plan.phases.find((p) => p.id === phaseId);
  if (!phase || phase.status !== "active") return null;

  phase.status = "completed";
  phase.completedAt = Date.now();

  // Auto-activate next phase
  const nextPhase = plan.phases.find((p) => p.order === phase.order + 1);
  if (nextPhase) {
    nextPhase.status = "active";
    nextPhase.startedAt = Date.now();
  }

  return HorizonRegistry.update(planId, { phases: plan.phases });
}

export function completeMilestone(
  planId: string,
  phaseId: string,
  milestoneId: string
): HorizonPlan | null {
  const plan = HorizonRegistry.get(planId);
  if (!plan) return null;

  const phase = plan.phases.find((p) => p.id === phaseId);
  if (!phase) return null;

  const ms = phase.milestones.find((m) => m.id === milestoneId);
  if (!ms) return null;

  ms.status = "completed";
  ms.completedAt = Date.now();
  return HorizonRegistry.update(planId, { phases: plan.phases });
}

export function executePhaseMissions(planId: string, phaseId: string): HorizonPlan | null {
  const plan = HorizonRegistry.get(planId);
  if (!plan) return null;

  const phase = plan.phases.find((p) => p.id === phaseId);
  if (!phase) return null;

  // Find missions linked to milestones in this phase
  for (const ms of phase.milestones) {
    const mission = MissionRegistry.get(ms.missionId);
    if (mission && mission.status === "draft") {
      MissionRegistry.update(ms.missionId, { status: "active", startedAt: Date.now() });
    }
  }

  return HorizonRegistry.get(planId);
}

export function getHorizonProgress(planId: string): {
  totalPhases: number;
  completedPhases: number;
  activePhases: number;
  pendingPhases: number;
  totalMilestones: number;
  completedMilestones: number;
} | null {
  const plan = HorizonRegistry.get(planId);
  if (!plan) return null;

  const totalPhases = plan.phases.length;
  const completedPhases = plan.phases.filter((p) => p.status === "completed").length;
  const activePhases = plan.phases.filter((p) => p.status === "active").length;
  const pendingPhases = plan.phases.filter((p) => p.status === "pending").length;

  const allMilestones = plan.phases.flatMap((p) => p.milestones);
  const totalMilestones = allMilestones.length;
  const completedMilestones = allMilestones.filter((m) => m.status === "completed").length;

  return { totalPhases, completedPhases, activePhases, pendingPhases, totalMilestones, completedMilestones };
}
