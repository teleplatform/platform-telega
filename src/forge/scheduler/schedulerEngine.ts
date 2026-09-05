import { SchedulePlan, SchedulePhase, ScheduleMilestone, ScheduleWindow, ScheduleDependency, ScheduleConflict } from "./schedulerTypes";

const plans = new Map<string, SchedulePlan>();

let counter = 0;
function genId(prefix: string): string {
  counter++;
  return `${prefix}_${Date.now()}_${counter}`;
}

function generateWindows(phases: number, milestonesPerPhase: number): { phases: SchedulePhase[]; totalDuration: number } {
  const now = Date.now();
  const MS_PER_DAY = 86400000;
  const DAYS_PER_PHASE = 14; // 2 weeks per phase
  const MS_PER_PHASE = DAYS_PER_PHASE * MS_PER_DAY;
  const MS_PER_MILESTONE = MS_PER_PHASE / milestonesPerPhase;

  const result: SchedulePhase[] = [];

  for (let p = 0; p < phases; p++) {
    const phaseStart = now + p * MS_PER_PHASE;
    const phaseEnd = phaseStart + MS_PER_PHASE;

    const milestones: ScheduleMilestone[] = [];
    for (let m = 0; m < milestonesPerPhase; m++) {
      const msDeadline = phaseStart + (m + 1) * MS_PER_MILESTONE;
      milestones.push({
        milestoneId: genId("ms"),
        title: `Milestone ${p + 1}.${m + 1}`,
        deadline: msDeadline,
        plannedWindow: { startAt: phaseStart + m * MS_PER_MILESTONE, endAt: msDeadline, durationMs: MS_PER_MILESTONE },
        actualWindow: null,
        status: "pending",
        dependencies: m > 0 ? [milestones[m - 1]?.milestoneId].filter(Boolean) as string[] : [],
      });
    }

    result.push({
      phaseId: genId("phase"),
      title: `Phase ${p + 1}`,
      order: p + 1,
      milestones,
      plannedWindow: { startAt: phaseStart, endAt: phaseEnd, durationMs: MS_PER_PHASE },
      actualWindow: null,
      status: p === 0 ? "scheduled" : "pending",
    });
  }

  return { phases: result, totalDuration: phases * MS_PER_PHASE };
}

export function buildSchedule(horizonPlanId: string, phases: number, milestonesPerPhase: number): SchedulePlan {
  const generated = generateWindows(phases, milestonesPerPhase);
  const now = Date.now();

  // Build dependencies between phases
  const dependencies: ScheduleDependency[] = [];
  for (let i = 0; i < generated.phases.length - 1; i++) {
    dependencies.push({
      fromId: generated.phases[i].phaseId,
      fromType: "phase",
      toId: generated.phases[i + 1].phaseId,
      toType: "phase",
      type: "blocks",
    });
  }

  const plan: SchedulePlan = {
    planId: genId("sched"),
    horizonPlanId,
    phases: generated.phases,
    dependencies,
    conflicts: [],
    status: "scheduled",
    createdAt: now,
    updatedAt: now,
  };

  plans.set(plan.planId, plan);
  return plan;
}

export function getSchedule(planId: string): SchedulePlan | undefined {
  return plans.get(planId);
}

export function getAllSchedules(): SchedulePlan[] {
  return Array.from(plans.values());
}

export function detectConflicts(planId: string): ScheduleConflict[] {
  const plan = plans.get(planId);
  if (!plan) return [];

  const conflicts: ScheduleConflict[] = [];
  const now = Date.now();

  // Check overdue milestones
  for (const phase of plan.phases) {
    for (const ms of phase.milestones) {
      if (ms.deadline && ms.deadline < now && ms.status === "pending") {
        conflicts.push({
          type: "deadline_miss",
          description: `Milestone "${ms.title}" is overdue (was due ${new Date(ms.deadline).toISOString()})`,
          items: [ms.milestoneId],
          severity: "critical",
        });
      }
    }
  }

  return conflicts;
}

export function advanceMilestone(planId: string, phaseId: string, milestoneId: string): SchedulePlan | null {
  const plan = plans.get(planId);
  if (!plan) return null;

  const phase = plan.phases.find((p) => p.phaseId === phaseId);
  if (!phase) return null;

  const ms = phase.milestones.find((m) => m.milestoneId === milestoneId);
  if (!ms) return null;

  const now = Date.now();
  ms.status = "completed";
  ms.actualWindow = { startAt: ms.plannedWindow?.startAt || now, endAt: now, durationMs: now - (ms.plannedWindow?.startAt || now) };

  // Check if all milestones in phase are done → advance phase
  const allMsDone = phase.milestones.every((m) => m.status === "completed");
  if (allMsDone) {
    phase.status = "completed";
    phase.actualWindow = { startAt: phase.plannedWindow?.startAt || now, endAt: now, durationMs: now - (phase.plannedWindow?.startAt || now) };

    // Auto-advance next phase
    const nextPhase = plan.phases.find((p) => p.order === phase.order + 1);
    if (nextPhase) {
      nextPhase.status = "scheduled";
    }
  }

  plan.updatedAt = now;
  plans.set(planId, plan);
  return plan;
}

export function getTimeline(planId: string): {
  planId: string;
  totalDurationMs: number;
  phases: Array<any>;
  blockers: string[];
  conflicts: ScheduleConflict[];
} | null {
  const plan = plans.get(planId);
  if (!plan) return null;

  const now = Date.now();
  const blockers: string[] = [];
  const conflicts = detectConflicts(planId);

  for (const c of conflicts) {
    if (c.severity === "critical") blockers.push(c.description);
  }

  return {
    planId,
    totalDurationMs: plan.phases.reduce((s, p) => s + (p.plannedWindow?.durationMs || 0), 0),
    phases: plan.phases.map((p) => ({
      name: p.title,
      startAt: p.plannedWindow?.startAt || 0,
      endAt: p.plannedWindow?.endAt || 0,
      status: p.status,
      milestones: p.milestones.map((m) => ({ name: m.title, deadline: m.deadline, status: m.status })),
    })),
    blockers,
    conflicts,
  };
}
